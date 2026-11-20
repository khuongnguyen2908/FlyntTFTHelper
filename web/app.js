/* TFT Helper — chạy thẳng trong trình duyệt, dữ liệu ở data.js (tạo bởi scripts/update-data.mjs). */
(() => {
'use strict';
const D = window.TFT_DATA;
if (!D) { document.body.innerHTML = '<p style="padding:20px">Chưa có dữ liệu. Chạy: <code>node scripts/update-data.mjs</code></p>'; return; }

// ---------- Chỉ mục ----------
const U = new Map(D.units.map(u => [u.id, u]));
const T = new Map(D.traits.map(t => [t.id, t]));
const I = new Map(D.items.map(i => [i.id, i]));
const A = new Map(D.augments.map(a => [a.id, a]));
const COMPONENTS = D.items.filter(i => i.kind === 'component');
const RECIPE = new Map(); // "a|b" (đã sắp xếp) -> item
D.items.filter(i => i.from.length === 2 && ['craftable', 'emblem', 'support'].includes(i.kind))
  .forEach(i => RECIPE.set([...i.from].sort().join('|'), i));
const unitTraits = u => u.traits.map(id => T.get(id)).filter(Boolean);
const LEVELS = [...new Set(D.comps.map(c => c.levellingVi))];

// ---------- Trạng thái (lưu trong trình duyệt) ----------
const KEY = 'tft-helper-state-v1';
const state = Object.assign(
  { mine: [], contested: [], comps: {}, augs: [], stage: '', level: 5, gold: 20, hp: 100, target: null },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

// ---------- Tiện ích ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const fmt = (n, d = 2) => n == null ? '–' : Number(n).toFixed(d);
const pct = n => n == null ? '–' : (n * 100).toFixed(1) + '%';

function uIcon(id, opt = {}) {
  const u = U.get(id);
  if (!u) return '';
  const cls = ['u', 'c' + u.cost, opt.size || '', opt.dim ? 'dim' : '', opt.owned ? 'owned' : '', opt.contested ? 'contested' : ''].join(' ');
  return `<span class="${cls}" data-unit="${esc(id)}" title="${esc(u.name)} (${u.cost} vàng)${opt.title ? ' – ' + esc(opt.title) : ''}">` +
    `<span class="fb">${esc(u.name)}</span><img loading="lazy" src="${esc(u.icon)}" alt="" onerror="this.remove()">` +
    `${u.unlock ? '<span class="lock" title="Cần mở khoá">🔒</span>' : ''}</span>`;
}
function iIcon(id, size = '') {
  const i = I.get(id);
  if (!i) return '';
  return `<img class="it ${size}" data-item="${esc(id)}" src="${esc(i.icon)}" alt="${esc(i.name)}" title="${esc(i.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'tag',textContent:${JSON.stringify(i.name).replace(/"/g, '&quot;')}}))">`;
}
function tChip(id, extra = '', cls = '') {
  const t = T.get(id);
  if (!t) return '';
  return `<span class="trait-chip ${cls}" data-trait="${esc(id)}" title="${esc(t.nameEn)}"><img src="${esc(t.icon)}" alt="" onerror="this.remove()">${esc(t.name)}${extra ? ' ' + extra : ''}</span>`;
}
function unitCell(id, items = [], opt = {}) {
  const u = U.get(id);
  return `<span class="ucell">${uIcon(id, opt)}<span class="items">${items.map(x => iIcon(x)).join('')}</span><span class="uname">${esc(u?.name || id)}</span></span>`;
}

// ---------- Tộc hệ đang kích ----------
function activeTraits(unitIds) {
  const uniq = [...new Set(unitIds)];
  const count = new Map();
  uniq.forEach(id => U.get(id)?.traits.forEach(t => count.set(t, (count.get(t) || 0) + 1)));
  return [...count.entries()].map(([id, n]) => {
    const t = T.get(id);
    if (!t) return null;
    const steps = t.steps.filter(s => s.min);
    const on = [...steps].reverse().find(s => n >= s.min);
    const next = steps.find(s => n < s.min);
    return { id, n, t, on, next };
  }).filter(Boolean).sort((a, b) => (!!b.on - !!a.on) || (b.on?.style || 0) - (a.on?.style || 0) || b.n - a.n);
}
function traitChipsFor(unitIds, onlyActive = false) {
  return activeTraits(unitIds).filter(x => (x.t.type !== 'unique' || x.on) && (!onlyActive || x.on)).map(x =>
    tChip(x.id, `<b>${x.n}</b>${x.next ? '/' + x.next.min : ''}`, x.on ? 'on st' + (x.on.style || 1) : '')).join('');
}

// ---------- Chia mảnh trang bị ----------
// targets: [{item, unit, w}] theo thứ tự ưu tiên; mỗi tướng tối đa 3 món. Trả về cách ghép được tổng điểm cao nhất.
function solveItems(compCounts, targets, maxPerUnit = 3) {
  const cnt = { ...compCounts };
  const usable = targets.filter(t => I.get(t.item)?.from.length === 2);
  let best = { score: 0, pick: [] };
  const perUnit = {};
  const cur = [];
  (function dfs(k, score) {
    if (score > best.score) best = { score, pick: [...cur] };
    if (k >= usable.length) return;
    // cận trên
    let rest = 0; for (let j = k; j < usable.length; j++) rest += usable[j].w;
    if (score + rest <= best.score) return;
    const t = usable[k];
    const [a, b] = I.get(t.item).from;
    const okUnit = (perUnit[t.unit] || 0) < maxPerUnit;
    const okComp = a === b ? (cnt[a] || 0) >= 2 : (cnt[a] || 0) >= 1 && (cnt[b] || 0) >= 1;
    if (okUnit && okComp) {
      cnt[a]--; cnt[b]--; perUnit[t.unit] = (perUnit[t.unit] || 0) + 1; cur.push(t);
      dfs(k + 1, score + t.w);
      cur.pop(); perUnit[t.unit]--; cnt[a]++; cnt[b]++;
    }
    dfs(k + 1, score);
  })(0, 0);
  const left = { ...compCounts };
  best.pick.forEach(t => { const [a, b] = I.get(t.item).from; left[a]--; left[b]--; });
  return { pick: best.pick, left };
}
function craftableNow(compCounts) {
  const out = [];
  for (const [key, item] of RECIPE) {
    const [a, b] = key.split('|');
    if (a === b ? (compCounts[a] || 0) >= 2 : (compCounts[a] || 0) >= 1 && (compCounts[b] || 0) >= 1) out.push(item);
  }
  return out;
}
const compTotal = c => Object.values(c).reduce((s, n) => s + (n || 0), 0);
function compTargets(comp) {
  const t = [];
  comp.builds.forEach((b, bi) => b.items.forEach((it, ii) => t.push({ item: it, unit: b.unit, w: 10 - bi * 2 - ii * 0.5 })));
  return t;
}
function unitTargets(unitId) {
  const ui = D.unitItems[unitId];
  if (!ui) return [];
  return ui.items.slice(0, 8).map((x, i) => ({ item: x.id, unit: unitId, w: 10 - i }));
}
function recipeHtml(item) {
  return `<span class="recipe">${iIcon(item.from[0])}+${iIcon(item.from[1])} = ${iIcon(item.id, 'md')} ${esc(item.name)}</span>`;
}
function itemPlanHtml(targets, label) {
  if (!compTotal(state.comps)) return '<p class="hint">Chưa chọn mảnh trang bị (mục 2).</p>';
  if (!targets.length) return '<p class="hint">Chưa có số liệu đồ cho tướng / đội này.</p>';
  const { pick, left } = solveItems(state.comps, targets);
  let h = '';
  if (pick.length) {
    h += `<div>${pick.map(p => `<div>${recipeHtml(I.get(p.item))} → ${uIcon(p.unit, { size: 'sm' })} ${esc(U.get(p.unit)?.name || '')}</div>`).join('')}</div>`;
  } else h += `<p class="hint">Mảnh hiện có chưa ghép được món nào trong lối lên đồ ${esc(label)}.</p>`;
  const leftList = Object.entries(left).filter(([, n]) => n > 0);
  if (leftList.length) {
    h += `<p class="stat">Mảnh còn lại: ${leftList.map(([id, n]) => iIcon(id) + (n > 1 ? '×' + n : '')).join(' ')}</p>`;
    // Món còn thiếu: thiếu đúng 1 mảnh
    const need = [];
    targets.forEach(t => {
      if (pick.includes(t)) return;
      const it = I.get(t.item); if (!it || it.from.length !== 2) return;
      const [a, b] = it.from;
      const have = a === b ? Math.min(left[a] || 0, 1) : ((left[a] || 0) > 0) + ((left[b] || 0) > 0);
      if (have === 1 && !need.some(n => n.item === t.item)) need.push({ ...t, miss: (left[a] || 0) > 0 && a !== b ? b : a });
    });
    if (need.length) h += `<p class="stat">Thiếu 1 mảnh: ${need.slice(0, 5).map(n => `${iIcon(n.item)} ${esc(I.get(n.item).name)} (cần ${iIcon(n.miss)})`).join(' · ')}</p>`;
  }
  return h;
}

// ---------- Chấm điểm đội hình theo tình huống ----------
function scoreComp(c) {
  const mine = new Set(state.mine), cont = new Set(state.contested);
  let s = 0; const why = [];
  const have = c.units.filter(u => mine.has(u));
  have.forEach(u => s += 1 + (U.get(u)?.cost || 1) * 0.5);
  const carriesHave = c.carries.filter(u => mine.has(u));
  s += carriesHave.length * 2;
  if (have.length) why.push(`có ${have.length}/${c.units.length} tướng`);
  if (carriesHave.length) why.push(`có chủ lực ${carriesHave.map(u => U.get(u)?.name).join(', ')}`);
  const contHit = c.units.filter(u => cont.has(u));
  contHit.forEach(u => s -= 1 + (U.get(u)?.cost || 1) * 0.4 + (c.carries.includes(u) ? 2 : 0));
  if (contHit.length) why.push(`<span class="bad">bị tranh ${contHit.map(u => U.get(u)?.name).join(', ')}</span>`);
  if (compTotal(state.comps)) {
    const { pick } = solveItems(state.comps, compTargets(c));
    s += pick.length * 1.5;
    if (pick.length) why.push(`ghép được ${pick.length} món chuẩn`);
  }
  const augTraits = new Set(state.augs.flatMap(a => A.get(a)?.traits || []));
  if (c.traits.some(t => augTraits.has(t.id))) { s += 3; why.push('hợp lõi đang có'); }
  if (c.avg != null) s += (4.5 - c.avg) * 2;
  return { c, s, why };
}

function tempoAdvice(target) {
  const out = [];
  const [st, rd] = String(state.stage || '').split('-').map(Number);
  const lvl = Number(state.level) || 0, gold = Number(state.gold) || 0, hp = Number(state.hp) || 100;
  const LEVEL_PLAN = [['2-1', 4], ['2-5', 5], ['3-2', 6], ['4-1', 7], ['4-2', 8], ['5-1', 9]];
  if (gold < 50) {
    const toNext = 10 - (gold % 10);
    out.push(`Lãi: đang ${Math.min(5, Math.floor(gold / 10))} vàng/vòng. Thêm ${toNext} vàng thì được thêm 1 vàng lãi.`);
  } else out.push('Đã đủ 50 vàng, lãi tối đa. Vàng dư trên 50 có thể dùng để lên cấp hoặc roll.');
  if (hp <= 30) out.push('<span class="bad">Máu thấp: ưu tiên làm bàn mạnh ngay (roll / lên cấp), đừng cố giữ vàng.</span>');
  else if (hp <= 50) out.push('Máu trung bình: bắt đầu dùng vàng dư trên 50 để giữ chuỗi thắng hoặc cắt chuỗi thua.');
  const reroll = target && /lvl (\d)/.exec(target.levelling || '');
  if (st && !(reroll && lvl >= Number(reroll[1]))) {
    const due = LEVEL_PLAN.filter(([r]) => { const [a, b] = r.split('-').map(Number); return st > a || (st === a && (rd || 1) >= b); }).at(-1);
    if (due && lvl < due[1]) out.push(`Mốc chuẩn: tới ${due[0]} thường đã lên cấp ${due[1]} (bạn đang cấp ${lvl}).`);
  }
  if (target) {
    const L = target.levelling || '';
    const m = L.match(/lvl (\d)/);
    if (m) {
      const n = Number(m[1]);
      out.push(`Đội <b>${esc(target.name)}</b> là đội reroll cấp ${n}: giữ cấp ${n}, roll chậm (chỉ tiêu phần vàng trên 50) tới khi chủ lực 3★, rồi mới lên cấp.`);
      if (lvl < n) out.push(`Lên cấp ${n} trước rồi mới bắt đầu roll.`);
    } else if (/Fast 9/.test(L)) out.push(`Đội <b>${esc(target.name)}</b> là đội lên nhanh cấp 9: tích vàng, lên 8 ở khoảng 4-1/4-2, roll vừa đủ ổn định, rồi lên 9 tìm tướng 5 vàng.`);
    else if (/Fast 8/.test(L)) out.push(`Đội <b>${esc(target.name)}</b> là đội lên nhanh cấp 8: giữ vàng, lên 8 ở khoảng 4-1, roll tìm tướng 4 vàng.`);
    else out.push(`Đội <b>${esc(target.name)}</b> chơi tiêu chuẩn: lên 7 ở khoảng 3-5/4-1, lên 8 ở 4-2 rồi roll.`);
  }
  return out;
}

// ---------- Mã đội hình (dán vào Team Planner trong game) ----------
// Định dạng: "02" + 10 ô × mã 3 ký tự của tướng ("000" = ô trống) + tên Set (vd TFTSet19).
function teamCode(unitIds) {
  const list = [...new Set(unitIds)].map(id => U.get(id)).filter(Boolean);
  const ok = list.filter(u => u.code);
  const skipped = list.filter(u => !u.code);
  let code = '02';
  for (let i = 0; i < 10; i++) code += ok[i] ? ok[i].code : '000';
  code += D.meta.setKey || ('TFTSet' + D.meta.set);
  return { code, skipped, over: ok.slice(10) };
}
function toast(html) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.innerHTML = html; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 6000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
async function copyTeam(unitIds, label) {
  if (!unitIds.length) { toast('Chưa có tướng nào để tạo mã.'); return; }
  const { code, skipped, over } = teamCode(unitIds);
  const ok = await copyText(code);
  let msg = ok ? `Đã copy mã ${esc(label)}. Vào game: Team Planner → Import (Nhập) → dán.` : 'Không copy tự động được, hãy bôi đen mã dưới đây rồi Ctrl+C.';
  msg += `<div class="code">${esc(code)}</div>`;
  if (skipped.length) msg += `<div class="bad">Bỏ qua (dữ liệu chưa có mã đúng): ${skipped.map(u => esc(u.name)).join(', ')}</div>`;
  if (over.length) msg += `<div class="bad">Quá 10 tướng, bỏ: ${over.map(u => esc(u.name)).join(', ')}</div>`;
  toast(msg);
}
const copyBtn = (key, label = '📋 Copy mã') => `<button class="small" data-copy-code="${esc(key)}" title="Copy mã đội để dán vào Team Planner trong game">${label}</button>`;

// ---------- Khung "Đội đang nhắm" ----------
const RARITY_ORDER = { Prismatic: 0, Gold: 1, Silver: 2 };
function targetAnalysis(c) {
  const mine = new Set(state.mine), cont = new Set(state.contested);
  const cost = id => U.get(id)?.cost || 1;
  const w = id => 1 + cost(id) * 0.5;
  const have = c.units.filter(u => mine.has(u));
  const missing = c.units.filter(u => !mine.has(u));
  const carries = [...new Set(c.carries)];
  const carriesHave = carries.filter(u => mine.has(u));
  const contested = c.units.filter(u => cont.has(u));
  const targets = compTargets(c);
  const hasComps = compTotal(state.comps) > 0;
  const { pick, left } = hasComps ? solveItems(state.comps, targets) : { pick: [], left: {} };
  const totalW = c.units.reduce((s, u) => s + w(u), 0) || 1;
  const unitRatio = have.reduce((s, u) => s + w(u), 0) / totalW;
  const carryRatio = carries.length ? carriesHave.length / carries.length : 0;
  const itemRatio = targets.length ? pick.length / Math.min(targets.length, Math.max(1, Math.floor(compTotal(state.comps) / 2))) : 0;
  let match = 100 * (0.6 * unitRatio + 0.25 * carryRatio + 0.15 * Math.min(1, itemRatio));
  contested.forEach(u => match -= carries.includes(u) ? 10 : 4);
  match = Math.max(0, Math.min(100, Math.round(match)));
  const empty = !state.mine.length && !hasComps;
  const verdict = empty ? null : match >= 55 ? ['good', 'Hợp'] : match >= 30 ? ['warn', 'Tạm được'] : ['bad', 'Chưa hợp'];
  return { mine, cont, have, missing, carries, carriesHave, contested, targets, pick, left, match, verdict, empty, hasComps };
}
function itemStatusRows(c, a) {
  const pickedKey = new Set(a.pick.map(p => p.unit + '|' + p.item));
  const need = {}; // mảnh còn thiếu cho các món chưa ghép được
  const pool = { ...a.left }; // mảnh còn lại, các món chưa ghép được lần lượt trừ chung
  const rows = c.builds.map(b => {
    const cells = b.items.map(it => {
      const item = I.get(it);
      if (!item) return '';
      if (pickedKey.has(b.unit + '|' + it)) return `<span class="istat ok" title="Ghép được ngay">${iIcon(it)} ${esc(item.name)} ✔</span>`;
      if (item.from.length !== 2) return `<span class="istat">${iIcon(it)} ${esc(item.name)}</span>`;
      const miss = [];
      item.from.forEach(p => { if ((pool[p] || 0) > 0) pool[p]--; else miss.push(p); });
      miss.forEach(p => need[p] = (need[p] || 0) + 1);
      if (!a.hasComps) return `<span class="istat">${iIcon(it)} ${esc(item.name)} <span class="stat">(${iIcon(item.from[0])}+${iIcon(item.from[1])})</span></span>`;
      if (miss.length === 1) return `<span class="istat warn">${iIcon(it)} ${esc(item.name)} <span class="stat">thiếu ${iIcon(miss[0])}</span></span>`;
      return `<span class="istat no">${iIcon(it)} ${esc(item.name)} <span class="stat">cần ${iIcon(item.from[0])}+${iIcon(item.from[1])}</span></span>`;
    }).join('');
    return `<div class="build-row">${uIcon(b.unit, { size: 'sm', owned: a.mine.has(b.unit) })}<b>${esc(U.get(b.unit)?.name || b.unit)}</b> ${cells}</div>`;
  }).join('');
  const needList = Object.entries(need).sort((x, y) => y[1] - x[1]);
  return { rows, needList };
}
function augmentsFor(c) {
  const traitIds = new Set(activeTraits(c.units).filter(x => x.on).map(x => x.id));
  return D.augments.filter(a => a.traits.some(t => traitIds.has(t)))
    .sort((x, y) => (RARITY_ORDER[x.rarity] ?? 3) - (RARITY_ORDER[y.rarity] ?? 3) || x.name.localeCompare(y.name));
}
function augmentHint(c) {
  const L = c.levelling || '';
  if (/lvl \d/.test(L)) return 'Đội reroll: lõi đầu (2-1) ưu tiên kinh tế hoặc lõi reroll / tướng rẻ; lõi 3-2 và 4-2 ưu tiên sức mạnh giao tranh hoặc lõi tộc hệ của đội.';
  if (/Fast/.test(L)) return 'Đội lên nhanh: ưu tiên lõi kinh tế / kinh nghiệm ở 2-1, sau đó lõi giao tranh hoặc lõi đồ cho chủ lực.';
  return 'Đội tiêu chuẩn: lõi giao tranh hoặc lõi đồ cho chủ lực; lõi kinh tế nếu đang chuỗi thắng / thua tốt.';
}
function renderTarget() {
  const box = $('#target-panel');
  const c = state.target && D.comps.find(x => x.id === state.target);
  if (!c) {
    box.innerHTML = `<div class="panel target-empty">Chưa nhắm đội nào. Bấm <b>Nhắm đội này</b> ở tab <a href="#" data-goto="comps">Đội hình mạnh</a> hoặc trong phần Gợi ý bên dưới để xem cần làm gì, cần đồ gì, lõi nào hợp.</div>`;
    return;
  }
  const a = targetAnalysis(c);
  const ranked = D.comps.map(scoreComp).sort((x, y) => y.s - x.s);
  const best = ranked[0];
  const self = ranked.find(r => r.c.id === c.id);
  const [st] = String(state.stage || '').split('-').map(Number);
  const items = itemStatusRows(c, a);
  const augs = augmentsFor(c);
  const myAugs = new Set(state.augs);
  const keep = new Set([...c.units, ...c.extraUnits]);
  const sell = [...new Set(state.mine)].filter(u => !keep.has(u));
  const reroll = /lvl (\d)/.exec(c.levelling || '');
  const buyOrder = [...a.missing].sort((x, y) => (a.carries.includes(y) - a.carries.includes(x)) * (reroll ? 1 : 0) || (U.get(x)?.cost || 0) - (U.get(y)?.cost || 0));

  // Mức khớp
  let matchHtml;
  if (a.empty) {
    matchHtml = '<p class="hint">Chưa chọn tướng / mảnh đồ đang có (mục 1, 2 bên dưới) nên chưa đo được mức khớp. Phần kế hoạch bên dưới vẫn dùng được.</p>';
  } else {
    const notes = [];
    notes.push(`Có <b>${a.have.length}/${c.units.length}</b> tướng`);
    notes.push(a.carries.length ? `chủ lực: ${a.carriesHave.length ? '<span class="good">' + a.carriesHave.map(u => esc(U.get(u)?.name)).join(', ') + '</span>' : '<span class="bad">chưa có</span>'} (cần ${a.carries.map(u => esc(U.get(u)?.name)).join(', ')})` : '');
    if (a.hasComps) notes.push(`mảnh đồ ghép được <b>${a.pick.length}</b> món chuẩn`);
    if (a.contested.length) notes.push(`<span class="bad">bị nhà khác tranh: ${a.contested.map(u => esc(U.get(u)?.name)).join(', ')}</span>`);
    matchHtml = `<div class="match"><span class="verdict ${a.verdict[0]}">${a.verdict[1]} · ${a.match}%</span> ${notes.filter(Boolean).join(' · ')}</div>`;
    if (st && st <= 2 && a.match < 55) matchHtml += '<p class="hint">Đầu trận khớp thấp là bình thường: giữ tướng rẻ cùng tộc hệ của đội, chưa cần đủ chủ lực.</p>';
    if (best && best.c.id !== c.id && self && best.s > self.s + 3) {
      matchHtml += `<p class="stat">Đội đang hợp tình huống hơn: <b>${esc(best.c.name)}</b> (${esc(best.c.levellingVi)}, hạng TB ${fmt(best.c.avg)}) <button class="small" data-target="${esc(best.c.id)}">Nhắm đội đó</button></p>`;
    }
  }

  const traitNow = activeTraits(state.mine);
  const traitGoal = activeTraits(c.units).filter(x => x.on).map(x => {
    const now = traitNow.find(y => y.id === x.id)?.n || 0;
    return tChip(x.id, `<b>${now}</b>/${x.n}`, now >= x.n ? 'on st4' : now ? 'on st1' : '');
  }).join('');

  box.innerHTML = `<div class="panel target">
    <div class="card-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><span class="comp-name">Đội đang nhắm: ${esc(c.name)}</span>
      <span class="stat">${esc(c.levellingVi)} · hạng TB <b>${fmt(c.avg)}</b></span>
      ${copyBtn('comp:' + c.id)} <button class="small" data-comp-detail="${esc(c.id)}">Chi tiết</button> <button class="small" data-untarget="1">Bỏ nhắm</button></div>
    ${matchHtml}
    <div class="units-row">${c.units.map(u => {
      const b = c.builds.find(x => x.unit === u);
      return unitCell(u, b ? b.items : [], { owned: a.mine.has(u), contested: a.cont.has(u), dim: !a.empty && !a.mine.has(u) });
    }).join('')}</div>
    <div><span class="stat">Tộc hệ (đang có / cần):</span> ${traitGoal}</div>

    <div class="target-grid">
      <div>
        <h3>Nên làm gì</h3>
        <ul>${tempoAdvice(c).map(t => `<li>${t}</li>`).join('')}
          <li>${reroll ? `Chủ lực cần <b>3★</b>: ${a.carries.filter(u => (U.get(u)?.cost || 9) <= Number(reroll[1]) - 2).map(u => esc(U.get(u)?.name)).join(', ') || a.carries.map(u => esc(U.get(u)?.name)).join(', ')}. Giữ mọi bản sao của chủ lực, kể cả khi chưa lên sân.` : `Chủ lực cần <b>2★</b>: ${a.carries.map(u => esc(U.get(u)?.name)).join(', ')}. Khi roll ưu tiên chủ lực và tank chính.`}</li>
          ${c.extraUnits.length ? `<li>Khi lên thêm cấp, có thể thêm: ${c.extraUnits.slice(0, 5).map(u => esc(U.get(u)?.name)).join(', ')}.</li>` : ''}
        </ul>
        <div><b>Mua ưu tiên</b> <span class="hint">(theo thứ tự)</span></div>
        <div class="icons">${buyOrder.map(u => uIcon(u, { size: 'sm', contested: a.cont.has(u), title: (a.carries.includes(u) ? 'chủ lực' : '') + (U.get(u)?.unlock ? ' 🔒 ' + U.get(u).unlock : '') })).join('') || '<span class="good">Đã đủ tướng.</span>'}</div>
        ${buyOrder.some(u => U.get(u)?.unlock) ? `<div class="stat" style="margin-top:4px">🔒 Cần mở khoá mới ra trong cửa hàng:<ul>${buyOrder.filter(u => U.get(u)?.unlock).map(u => `<li><b>${esc(U.get(u).name)}</b>${U.get(u).unlockLevel ? ' (từ cấp ' + U.get(u).unlockLevel + ')' : ''}: ${esc(U.get(u).unlock)}</li>`).join('')}</ul></div>` : ''}
        ${sell.length ? `<div style="margin-top:6px"><b>Có thể bán</b> <span class="hint">(không thuộc đội)</span></div><div class="icons">${sell.map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}
      </div>
      <div>
        <h3>Đồ cần</h3>
        ${items.rows || '<p class="hint">Chưa có số liệu đồ cho đội này.</p>'}
        ${!a.hasComps ? '<p class="hint">Chọn mảnh đang có (mục 2) để biết món nào ghép được ngay.</p>' : ''}
        ${a.hasComps && items.needList.length ? `<p class="stat">Mảnh nên ưu tiên nhặt: ${items.needList.slice(0, 5).map(([id, n]) => iIcon(id) + ' ' + esc(I.get(id)?.name) + (n > 1 ? ' ×' + n : '')).join(' · ')}</p>` : ''}
        ${c.topItems.length ? `<p class="stat">Đồ khác hay dùng trong đội: ${c.topItems.slice(0, 6).map(x => iIcon(x)).join(' ')}</p>` : ''}
        <h3>Lõi hợp</h3>
        <p class="hint">${augmentHint(c)} Chưa có số liệu tỉ lệ thắng lõi Set 19, các lõi dưới đây chọn theo tộc hệ của đội.</p>
        <div class="tags">${augs.slice(0, 16).map(x => `<span class="tag ${x.rarity === 'Gold' ? 'gold' : x.rarity === 'Prismatic' ? 'prism' : 'silver'} ${myAugs.has(x.id) ? 'mine' : ''}" title="${esc(x.desc)}">${myAugs.has(x.id) ? '✔ ' : ''}${esc(x.name)}</span>`).join('') || '<span class="hint">Không có lõi riêng cho tộc hệ của đội.</span>'}</div>
        ${state.augs.length ? `<p class="stat">Lõi bạn có: ${state.augs.map(id => { const x = A.get(id); return x ? (augs.some(y => y.id === id) ? '<span class="good">' + esc(x.name) + ' (hợp)</span>' : esc(x.name)) : ''; }).join(', ')}</p>` : ''}
      </div>
    </div>
  </div>`;
}

// ---------- Tab: Tình huống ----------
function renderUnitPool() {
  const q = norm($('#board-unit-search').value);
  const mine = new Set(state.mine), cont = new Set(state.contested);
  const byCost = {};
  D.units.filter(u => !q || norm(u.name).includes(q) || norm(u.nameEn).includes(q) || unitTraits(u).some(t => norm(t.name).includes(q) || norm(t.nameEn).includes(q)))
    .forEach(u => (byCost[u.cost] ||= []).push(u));
  $('#board-unit-pool').innerHTML = Object.keys(byCost).sort((a, b) => a - b).map(c =>
    `<div class="cost-row"><span class="lbl">${c}💰</span>${byCost[c].sort((a, b) => a.name.localeCompare(b.name)).map(u =>
      uIcon(u.id, { owned: mine.has(u.id), contested: cont.has(u.id) })).join('')}</div>`).join('');
}
function renderChosen() {
  $('#mine-list').innerHTML = state.mine.map((id, i) => `<span data-rm-mine="${i}">${uIcon(id, { size: 'sm' })}</span>`).join('') || '<span class="hint">chưa chọn</span>';
  $('#contested-list').innerHTML = state.contested.map((id, i) => `<span data-rm-cont="${i}">${uIcon(id, { size: 'sm' })}</span>`).join('') || '<span class="hint">chưa chọn</span>';
}
function renderComponents() {
  $('#component-picker').innerHTML = COMPONENTS.map(c => {
    const n = state.comps[c.id] || 0;
    return `<div class="comp-btn ${n ? 'has' : ''}" data-comp="${esc(c.id)}" title="${esc(c.name)} — bấm để thêm, chuột phải để bớt">
      ${n ? `<span class="cnt">${n}</span>` : ''}<img src="${esc(c.icon)}" alt=""><div class="nm">${esc(c.name)}</div></div>`;
  }).join('');
}
function renderAugChosen() {
  $('#aug-chosen').innerHTML = state.augs.map((id, i) => {
    const a = A.get(id);
    return a ? `<span class="tag ${a.rarity === 'Gold' ? 'gold' : a.rarity === 'Prismatic' ? 'prism' : 'silver'}" data-rm-aug="${i}" title="Bấm để bỏ">${esc(a.name)} ✕</span>` : '';
  }).join('');
}
function renderAdvice() {
  const parts = [];
  // Tộc hệ hiện tại
  if (state.mine.length) parts.push(`<div class="adv-section"><b>Tộc hệ đang có:</b><div>${traitChipsFor(state.mine)}</div></div>`);

  const ranked = D.comps.map(scoreComp).sort((a, b) => b.s - a.s);
  const explicit = state.target && D.comps.find(c => c.id === state.target);
  const target = explicit || (state.mine.length || compTotal(state.comps) ? ranked[0]?.c : null);
  renderTarget();

  const tempo = tempoAdvice(explicit ? null : target);
  parts.push(`<div class="adv-section"><b>Bước tiếp theo:</b><ul>${tempo.map(t => `<li>${t}</li>`).join('')}</ul></div>`);

  if (!state.mine.length && !compTotal(state.comps)) {
    parts.push('<p class="hint">Chọn tướng và mảnh trang bị bạn đang có, tool sẽ gợi ý đội hình hợp nhất và cách ghép đồ. Muốn được tư vấn kỹ hơn (cửa hàng, bàn nhà khác, chọn lõi), chụp màn hình rồi dán vào chat Claude.</p>');
  } else {
    const mine = new Set(state.mine), cont = new Set(state.contested);
    parts.push(`<div class="adv-section"><b>Đội hình hợp nhất lúc này:</b>${ranked.slice(0, 5).map((r, idx) => {
      const c = r.c;
      const isT = target && c.id === target.id;
      return `<div class="card" style="${isT ? 'border-color:var(--accent)' : ''}">
        <div class="card-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><span class="comp-name">${idx + 1}. ${esc(c.name)}</span>
        <span class="stat">${esc(c.levellingVi)} · hạng TB <b>${fmt(c.avg)}</b></span>
        ${isT && explicit ? '<span class="good">● đang nhắm</span>' : `<button class="small" data-target="${esc(c.id)}">Nhắm đội này</button>`}
        ${copyBtn('comp:' + c.id)}
        <button class="small" data-comp-detail="${esc(c.id)}">Chi tiết</button></div>
        <div class="score">${r.why.join(' · ') || '—'}</div>
        <div class="units-row">${c.units.map(u => {
          const b = c.builds.find(x => x.unit === u);
          return unitCell(u, b ? b.items : [], { owned: mine.has(u), contested: cont.has(u), dim: !mine.has(u) });
        }).join('')}</div>
        <div class="stat">Còn thiếu: ${c.units.filter(u => !mine.has(u)).map(u => esc(U.get(u)?.name)).join(', ') || '<span class="good">đủ rồi</span>'}</div>
      </div>`;
    }).join('')}</div>`);
  }

  if (target && !explicit) {
    parts.push(`<div class="adv-section"><b>Ghép đồ cho đội ${esc(target.name)}:</b>${itemPlanHtml(compTargets(target), 'của đội này')}</div>`);
    // Bán gì
    if (state.mine.length) {
      const keep = new Set([...target.units, ...target.extraUnits]);
      const sell = [...new Set(state.mine)].filter(u => !keep.has(u));
      if (sell.length) parts.push(`<div class="adv-section"><b>Tướng không nằm trong đội đang nhắm</b> <span class="hint">(cân nhắc bán khi cần chỗ / vàng):</span><div class="icons">${sell.map(u => uIcon(u, { size: 'sm' })).join('')}</div></div>`);
    }
  }
  if (compTotal(state.comps)) {
    const now = craftableNow(state.comps);
    parts.push(`<div class="adv-section"><b>Có thể ghép ngay (mọi món):</b><div>${now.map(recipeHtml).join('') || '<span class="hint">chưa đủ mảnh</span>'}</div></div>`);
  }
  $('#advice').innerHTML = parts.join('');
}
function renderBoard() { renderUnitPool(); renderChosen(); renderComponents(); renderAugChosen(); renderAdvice(); }

function bindBoard() {
  $('#board-unit-search').addEventListener('input', renderUnitPool);
  $('#board-unit-pool').addEventListener('click', e => {
    const el = e.target.closest('[data-unit]'); if (!el) return;
    e.stopPropagation();
    const id = el.dataset.unit;
    const mode = document.querySelector('input[name=pickmode]:checked').value;
    if (mode === 'mine') state.mine.push(id);
    else if (!state.contested.includes(id)) state.contested.push(id);
    save(); renderBoard();
  }, true);
  $('#mine-list').addEventListener('click', e => {
    const el = e.target.closest('[data-rm-mine]'); if (!el) return; e.stopPropagation();
    state.mine.splice(Number(el.dataset.rmMine), 1); save(); renderBoard();
  }, true);
  $('#contested-list').addEventListener('click', e => {
    const el = e.target.closest('[data-rm-cont]'); if (!el) return; e.stopPropagation();
    state.contested.splice(Number(el.dataset.rmCont), 1); save(); renderBoard();
  }, true);
  $('#clear-units').addEventListener('click', () => { state.mine = []; state.contested = []; state.target = null; save(); renderBoard(); });
  $('#clear-comps').addEventListener('click', () => { state.comps = {}; save(); renderBoard(); });
  const comp = $('#component-picker');
  comp.addEventListener('click', e => {
    const el = e.target.closest('[data-comp]'); if (!el) return;
    state.comps[el.dataset.comp] = (state.comps[el.dataset.comp] || 0) + 1; save(); renderComponents(); renderAdvice();
  });
  comp.addEventListener('contextmenu', e => {
    const el = e.target.closest('[data-comp]'); if (!el) return; e.preventDefault();
    const id = el.dataset.comp; state.comps[id] = Math.max(0, (state.comps[id] || 0) - 1); save(); renderComponents(); renderAdvice();
  });
  $('#aug-search').addEventListener('input', () => {
    const q = norm($('#aug-search').value);
    $('#aug-suggest').innerHTML = q.length < 2 ? '' : D.augments.filter(a => norm(a.name).includes(q) || norm(a.nameEn).includes(q)).slice(0, 12)
      .map(a => `<div data-add-aug="${esc(a.id)}">${esc(a.name)} <span class="muted">(${esc(a.rarity)})</span></div>`).join('');
  });
  $('#aug-suggest').addEventListener('click', e => {
    const el = e.target.closest('[data-add-aug]'); if (!el) return;
    if (!state.augs.includes(el.dataset.addAug)) state.augs.push(el.dataset.addAug);
    $('#aug-search').value = ''; $('#aug-suggest').innerHTML = ''; save(); renderAugChosen(); renderAdvice();
  });
  $('#aug-chosen').addEventListener('click', e => {
    const el = e.target.closest('[data-rm-aug]'); if (!el) return;
    state.augs.splice(Number(el.dataset.rmAug), 1); save(); renderAugChosen(); renderAdvice();
  });
  [['#st-stage', 'stage'], ['#st-level', 'level'], ['#st-gold', 'gold'], ['#st-hp', 'hp']].forEach(([sel, k]) => {
    const el = $(sel); el.value = state[k] ?? '';
    el.addEventListener('input', () => { state[k] = el.value; save(); renderAdvice(); });
  });
  $('#advice').addEventListener('click', e => {
    const t = e.target.closest('[data-target]');
    if (t) { state.target = t.dataset.target; save(); renderAdvice(); scrollToTarget(); }
  });
  $('#target-panel').addEventListener('click', e => {
    const t = e.target.closest('[data-target]');
    if (t) { state.target = t.dataset.target; save(); renderAdvice(); scrollToTarget(); return; }
    if (e.target.closest('[data-untarget]')) { state.target = null; save(); renderAdvice(); }
  });
  $('#copy-mine').addEventListener('click', () => copyTeam(state.mine, 'bàn của bạn'));
}

// ---------- Tab: Đội hình ----------
function compCard(c) {
  return `<div class="card">
    <div class="card-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><span class="comp-name">${esc(c.name)}</span>
      <span class="stat">${esc(c.levellingVi)} · hạng TB <b>${fmt(c.avg)}</b> · ${(c.count || 0).toLocaleString('vi-VN')} trận · tỉ lệ chơi <b>${pct(c.share)}</b></span>
      <button class="small" data-comp-detail="${esc(c.id)}">Chi tiết</button>
      <button class="small" data-use-comp="${esc(c.id)}">Nhắm đội này</button>
      ${copyBtn('comp:' + c.id)}</div>
    <div class="units-row">${c.units.map(u => { const b = c.builds.find(x => x.unit === u); return unitCell(u, b ? b.items : []); }).join('')}</div>
    <div>${traitChipsFor(c.units, true)}</div>
  </div>`;
}
function renderComps() {
  const q = norm($('#comp-search').value), lv = $('#comp-level').value;
  const list = D.comps.filter(c => (!lv || c.levellingVi === lv) && (!q || norm(c.name).includes(q) ||
    c.units.some(u => norm(U.get(u)?.name).includes(q) || norm(U.get(u)?.nameEn).includes(q)) ||
    c.traits.some(t => norm(T.get(t.id)?.name).includes(q) || norm(T.get(t.id)?.nameEn).includes(q))));
  $('#comps-note').innerHTML = `Số liệu ${esc(D.meta.compsQueue)} (${esc(D.meta.compsSet)}), ${(D.meta.compsGames || 0).toLocaleString('vi-VN')} lượt chơi. Bậc S–D chia theo hạng trung bình (càng thấp càng tốt), chỉ tính đội đủ số trận. Ở PBE số liệu còn dao động.`;
  $('#comp-list').innerHTML = list.map(compCard).join('') || '<p class="hint">Không có đội nào khớp.</p>';
}
function compDetail(id) {
  const c = D.comps.find(x => x.id === id); if (!c) return;
  const tr = c.trends || [];
  openModal(`<div class="card-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><h2 style="margin:0">${esc(c.name)}</h2></div>
    <p class="stat">${esc(c.levellingVi)} · hạng TB <b>${fmt(c.avg)}</b> · ${(c.count || 0).toLocaleString('vi-VN')} trận · tỉ lệ chơi ${pct(c.share)}</p>
    <h3>Đội hình</h3><div class="units-row">${c.units.map(u => { const b = c.builds.find(x => x.unit === u); return unitCell(u, b ? b.items : []); }).join('')}</div>
    <div>${traitChipsFor(c.units, true)}</div>
    <h3>Lên đồ chủ lực</h3>${c.builds.map(b => `<div class="row" style="margin-bottom:4px">${uIcon(b.unit, { size: 'sm' })} <span>${b.items.map(x => iIcon(x) + ' ' + esc(I.get(x)?.name || x)).join(' · ')}</span> <span class="stat">hạng TB ${fmt(b.avg)} (${b.count} trận)</span></div>`).join('')}
    <h3>Đồ hay dùng trong đội</h3><div>${c.topItems.map(x => iIcon(x, 'md')).join(' ')}</div>
    ${c.extraUnits.length ? `<h3>Tướng thay thế / thêm khi lên cấp</h3><div class="icons">${c.extraUnits.map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}
    <h3>Ghép đồ từ mảnh đang có</h3>${itemPlanHtml(compTargets(c), 'của đội này')}
    <p><button class="primary" data-use-comp="${esc(c.id)}">Nhắm đội này ở tab Tình huống</button> ${copyBtn('comp:' + c.id, '📋 Copy mã đội để dán vào game')}</p>`);
}

// ---------- Tab: Tướng ----------
function renderUnits() {
  const q = norm($('#unit-search').value), tr = $('#unit-trait').value, cost = $('#unit-cost').value;
  const list = D.units.filter(u => (!cost || u.cost == cost) && (!tr || u.traits.includes(tr)) &&
    (!q || norm(u.name).includes(q) || norm(u.nameEn).includes(q))).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  $('#unit-list').innerHTML = `<div class="grid-list">${list.map(u => {
    const ui = D.unitItems[u.id];
    return `<div class="card" data-unit="${esc(u.id)}" style="cursor:pointer"><div class="row">${uIcon(u.id, { size: 'lg' })}
      <div><b>${esc(u.name)}</b> <span class="stat">${u.cost} vàng · ${esc(u.role)}</span>${u.unlock ? ' <span class="stat">🔒 mở khoá</span>' : ''}
      <div>${u.traits.map(t => tChip(t)).join('')}</div>
      ${ui ? `<div style="margin-top:3px">${ui.items.slice(0, 5).map(x => iIcon(x.id)).join(' ')}</div>` : ''}</div></div></div>`;
  }).join('')}</div>`;
}
function unitDetail(id) {
  const u = U.get(id); if (!u) return;
  const s = u.stats, ui = D.unitItems[id];
  const inComps = D.comps.filter(c => c.units.includes(id)).slice(0, 6);
  openModal(`<div class="row">${uIcon(id, { size: 'lg' })}<div><h2 style="margin:0">${esc(u.name)}</h2>
      <div class="stat">${u.cost} vàng · ${esc(u.role)} · ${u.pool ? u.pool + ' con trong bể' : ''}</div><div>${u.traits.map(t => tChip(t)).join('')}</div></div></div>
    ${u.unlock ? `<p class="stat">🔒 <b>Mở khoá${u.unlockLevel ? ' (từ cấp ' + u.unlockLevel + ')' : ''}:</b> ${esc(u.unlock)}</p>` : ''}
    <h3>Kỹ năng: ${esc(u.ability.name)}</h3><div class="desc">${esc(u.ability.desc)}</div>
    <p class="hint">Số dạng a/b/c là theo 1★/2★/3★. (SMPT) / (SMCK) nghĩa là tăng theo Sức mạnh phép / công.</p>
    <table class="stats"><tr><td>Máu ${s.hp ?? '–'}</td><td>Giáp ${s.armor ?? '–'}</td><td>Kháng phép ${s.mr ?? '–'}</td><td>Công ${s.ad ?? '–'}</td></tr>
      <tr><td>Tốc đánh ${s.as ?? '–'}</td><td>Tầm ${s.range ?? '–'}</td><td>Năng lượng ${s.startMana ?? 0}/${s.mana ?? '–'}</td><td></td></tr></table>
    <h3>Đồ hay lên</h3>${ui ? `<div>${ui.items.slice(0, 8).map(x => `<span class="recipe">${iIcon(x.id)} ${esc(I.get(x.id)?.name || x.id)} <span class="stat">TB ${fmt(x.avg)}</span></span>`).join('')}</div>
      <h3>Bộ đồ 3 món tốt</h3>${ui.builds.map(b => `<div>${b.items.map(x => iIcon(x)).join(' ')} <span class="stat">hạng TB ${fmt(b.avg)} · ${b.count} trận</span></div>`).join('')}` : '<p class="hint">Chưa có số liệu đồ (tướng ít xuất hiện làm chủ lực).</p>'}
    <h3>Lên đồ từ mảnh đang có</h3>${itemPlanHtml(unitTargets(id), 'của tướng này')}
    ${inComps.length ? `<h3>Có trong đội hình</h3>${inComps.map(c => `<div><span class="tier ${esc(c.tier)}" style="width:22px;height:22px;font-size:12px">${esc(c.tier)}</span> <a href="#" data-comp-detail="${esc(c.id)}">${esc(c.name)}</a> <span class="stat">hạng TB ${fmt(c.avg)}</span></div>`).join('')}` : ''}`);
}

// ---------- Tab: Tộc hệ ----------
const TYPE_VI = { origin: 'Tộc', class: 'Hệ', unique: 'Riêng' };
function traitCard(t) {
  return `<div class="card"><div class="card-h"><img src="${esc(t.icon)}" style="width:28px;height:28px" alt="" onerror="this.remove()"><b>${esc(t.name)}</b> <span class="stat">${TYPE_VI[t.type] || ''} · ${esc(t.nameEn)}</span></div>
    <div class="desc">${esc(t.desc)}</div>
    ${t.steps.filter(s => s.desc).map(s => `<div class="desc">• ${esc(s.desc)}</div>`).join('')}
    <div class="icons" style="margin-top:6px">${t.units.map(u => uIcon(u, { size: 'sm' })).join('')}</div></div>`;
}
function renderTraits() {
  const q = norm($('#trait-search').value);
  const list = D.traits.filter(t => t.type !== 'unique' && (!q || norm(t.name).includes(q) || norm(t.nameEn).includes(q)))
    .sort((a, b) => (a.type > b.type ? -1 : a.type < b.type ? 1 : 0) || a.name.localeCompare(b.name));
  $('#trait-list').innerHTML = `<div class="grid-list">${list.map(traitCard).join('')}</div>
    <h3>Tộc hệ riêng của từng tướng</h3><div class="grid-list">${D.traits.filter(t => t.type === 'unique' && (!q || norm(t.name).includes(q))).map(traitCard).join('')}</div>`;
}

// ---------- Tab: Trang bị ----------
function renderMatrix() {
  const comps = COMPONENTS;
  const have = state.comps;
  let h = '<table class="matrix"><tr><th></th>' + comps.map(c => `<th>${iIcon(c.id)}</th>`).join('') + '</tr>';
  comps.forEach(a => {
    h += `<tr><th>${iIcon(a.id)}</th>` + comps.map(b => {
      const it = RECIPE.get([a.id, b.id].sort().join('|'));
      const can = a.id === b.id ? (have[a.id] || 0) >= 2 : (have[a.id] || 0) && (have[b.id] || 0);
      return `<td class="${can ? 'hl' : ''}">${it ? iIcon(it.id) : ''}</td>`;
    }).join('') + '</tr>';
  });
  $('#item-matrix').innerHTML = h + '</table><p class="hint">Ô sáng = ghép được bằng mảnh đang chọn ở tab Tình huống.</p>';
}
function usersOf(itemId) {
  return Object.entries(D.unitItems).map(([u, x]) => ({ u, c: x.items.find(i => i.id === itemId)?.count || 0 }))
    .filter(x => x.c).sort((a, b) => b.c - a.c).slice(0, 8).map(x => x.u);
}
function renderItems() {
  const kind = $('#item-kind').value, q = norm($('#item-search').value);
  $('#item-matrix').style.display = kind === 'craftable' ? '' : 'none';
  if (kind === 'craftable') renderMatrix();
  const list = D.items.filter(i => i.kind === kind && (!q || norm(i.name).includes(q) || norm(i.nameEn).includes(q)));
  $('#item-list').innerHTML = `<div class="grid-list">${list.map(i => {
    const users = usersOf(i.id);
    return `<div class="card"><div class="row">${iIcon(i.id, 'md')}<div><b>${esc(i.name)}</b> <span class="stat">${esc(i.nameEn)}</span>
      ${i.from.length === 2 ? `<div>${iIcon(i.from[0])} + ${iIcon(i.from[1])}</div>` : ''}
      ${i.stats ? `<div class="stat">${esc(i.stats)}</div>` : ''}</div></div>
      <div class="desc">${esc(i.desc)}</div>
      ${users.length ? `<div class="stat" style="margin-top:4px">Hay dùng cho: <span class="icons">${users.map(u => uIcon(u, { size: 'sm' })).join('')}</span></div>` : ''}</div>`;
  }).join('')}</div>`;
}
function itemDetail(id) {
  const i = I.get(id); if (!i) return;
  const users = usersOf(id);
  openModal(`<div class="row">${iIcon(id, 'md')}<div><h2 style="margin:0">${esc(i.name)}</h2><span class="stat">${esc(i.nameEn)}</span></div></div>
    ${i.from.length === 2 ? `<p>${iIcon(i.from[0])} ${esc(I.get(i.from[0])?.name)} + ${iIcon(i.from[1])} ${esc(I.get(i.from[1])?.name)}</p>` : ''}
    ${i.stats ? `<p class="stat">${esc(i.stats)}</p>` : ''}<div class="desc">${esc(i.desc)}</div>
    ${users.length ? `<h3>Hay dùng cho</h3><div class="icons">${users.map(u => uIcon(u)).join('')}</div>` : ''}
    ${i.kind === 'component' ? `<h3>Ghép với mảnh khác</h3>${COMPONENTS.map(c => RECIPE.get([id, c.id].sort().join('|'))).filter(Boolean).map(recipeHtml).join('')}` : ''}`);
}

// ---------- Tab: Lõi ----------
const RARITY_VI = { Silver: 'Bạc', Gold: 'Vàng', Prismatic: 'Kim Cương' };
function renderAugments() {
  const q = norm($('#augment-search').value), r = $('#augment-rarity').value, tg = $('#augment-tag').value;
  const list = D.augments.filter(a => (!r || a.rarity === r) && (!tg || a.tags.includes(tg)) &&
    (!q || norm(a.name).includes(q) || norm(a.nameEn).includes(q) || norm(a.desc).includes(q)));
  $('#augment-list').innerHTML = `<p class="stat">${list.length} lõi</p><div class="grid-list">${list.map(a => `<div class="card">
    <div class="row"><img src="${esc(a.icon)}" style="width:40px;height:40px;border-radius:6px" alt="" onerror="this.remove()" loading="lazy">
    <div><b>${esc(a.name)}</b> <span class="tag ${a.rarity === 'Gold' ? 'gold' : a.rarity === 'Prismatic' ? 'prism' : 'silver'}">${RARITY_VI[a.rarity] || esc(a.rarity)}</span>
    <div class="stat">${esc(a.nameEn)}${a.rounds.length ? ' · vòng ' + a.rounds.map(esc).join(', ') : ''}${a.tags.length ? ' · ' + a.tags.map(esc).join(', ') : ''}</div>
    ${a.traits.length ? `<div>${a.traits.map(t => tChip(t)).join('')}</div>` : ''}</div></div>
    <div class="desc">${esc(a.desc)}</div></div>`).join('')}</div>`;
}

// ---------- Tab: Mẹo ----------
function renderTips() {
  $('#tips').innerHTML = `<div class="grid-list">
  <div class="card"><b>Mốc lên cấp tiêu chuẩn</b><div class="desc">2-1: cấp 4
2-5: cấp 5
3-2: cấp 6
3-5 hoặc 4-1: cấp 7
4-2 (hoặc 4-5): cấp 8, roll tìm tướng 4 vàng
5-1 trở đi: cấp 9 nếu đội cần tướng 5 vàng</div></div>
  <div class="card"><b>Lãi và vàng</b><div class="desc">Mỗi 10 vàng trong túi được +1 vàng lãi, tối đa +5 ở 50 vàng.
Chuỗi thắng / thua cho thêm vàng, nên giữ chuỗi.
Đội reroll: giữ cấp, chỉ roll phần vàng trên 50 cho tới khi chủ lực 3★.
Đội lên nhanh: giữ 50 vàng, lên cấp đúng mốc, roll mạnh một lần ở cấp 8 / 9.</div></div>
  <div class="card"><b>Ghép đồ</b><div class="desc">Ghép sớm đồ mạnh (slam) để giữ máu, đừng giữ mảnh quá lâu.
Đồ cho chủ lực xem ở tab Đội hình hoặc bấm vào tướng.
Xẻng / Chảo ghép ra Ấn, dùng để kích thêm tộc hệ.</div></div>
  <div class="card"><b>Set 19 – Prismatic Tour</b><div class="desc">Có ${D.units.filter(u => u.unlock).length} tướng phải mở khoá (biểu tượng 🔒) mới xuất hiện trong cửa hàng. Điều kiện xem trong chi tiết tướng.
Có tướng 7 vàng: ${D.units.filter(u => u.cost === 7).map(u => esc(u.name)).join(', ')}.</div></div>
  <div class="card"><b>Hỏi Claude khi đang chơi</b><div class="desc">Bấm Win+Shift+S, chụp màn hình game, dán vào chat Claude ở dự án này.
Hỏi ví dụ: "nên roll hay lên cấp?", "chọn lõi nào?", "nhà nào đang tranh tướng?".
Chụp cả bàn nhà khác (bấm vào ảnh đại diện của họ) để Claude kiểm tra ai đang chơi đội gì.</div></div>
  <div class="card"><b>Cập nhật dữ liệu</b><div class="desc">Chạy: node scripts/update-data.mjs
Dữ liệu hiện tại: ${esc(D.meta.setName)} (${esc(D.meta.patch)}), cập nhật lúc ${esc(new Date(D.meta.fetchedAt).toLocaleString('vi-VN'))}.</div></div>
  </div>`;
}

// ---------- Modal + điều hướng ----------
function scrollToTarget() {
  const el = $('#target-panel');
  if (!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
}
function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function showTab(name) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  ({ board: renderBoard, comps: renderComps, units: renderUnits, traits: renderTraits, items: renderItems, augments: renderAugments, tips: renderTips })[name]?.();
  try { localStorage.setItem('tft-helper-tab', name); } catch {}
}

function init() {
  $('#meta').textContent = `${D.meta.setName || 'Set ' + D.meta.set} · ${D.meta.patch} · ${D.units.length} tướng · cập nhật ${new Date(D.meta.fetchedAt).toLocaleDateString('vi-VN')}`;
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Bộ lọc
  LEVELS.forEach(l => $('#comp-level').insertAdjacentHTML('beforeend', `<option>${esc(l)}</option>`));
  D.traits.filter(t => t.type !== 'unique').sort((a, b) => a.name.localeCompare(b.name))
    .forEach(t => $('#unit-trait').insertAdjacentHTML('beforeend', `<option value="${esc(t.id)}">${esc(t.name)}</option>`));
  [...new Set(D.units.map(u => u.cost))].sort((a, b) => a - b).forEach(c => $('#unit-cost').insertAdjacentHTML('beforeend', `<option>${c}</option>`));
  [...new Set(D.augments.flatMap(a => a.tags))].sort().forEach(t => $('#augment-tag').insertAdjacentHTML('beforeend', `<option>${esc(t)}</option>`));
  [['#comp-search', renderComps], ['#comp-level', renderComps], ['#unit-search', renderUnits], ['#unit-trait', renderUnits], ['#unit-cost', renderUnits],
   ['#trait-search', renderTraits], ['#item-kind', renderItems], ['#item-search', renderItems],
   ['#augment-search', renderAugments], ['#augment-rarity', renderAugments], ['#augment-tag', renderAugments]]
    .forEach(([s, f]) => { $(s).addEventListener('input', f); $(s).addEventListener('change', f); });

  bindBoard();

  // Bấm chung: tướng / đồ / tộc hệ / đội hình → mở chi tiết
  document.addEventListener('click', e => {
    if (e.target.closest('#board-unit-pool, #mine-list, #contested-list')) return;
    const cd = e.target.closest('[data-comp-detail]'); if (cd) { e.preventDefault(); compDetail(cd.dataset.compDetail); return; }
    const cc = e.target.closest('[data-copy-code]');
    if (cc) {
      e.preventDefault();
      const key = cc.dataset.copyCode;
      if (key.startsWith('comp:')) { const c = D.comps.find(x => x.id === key.slice(5)); if (c) copyTeam(c.units, 'đội ' + c.name); }
      return;
    }
    const gt = e.target.closest('[data-goto]'); if (gt) { e.preventDefault(); showTab(gt.dataset.goto); return; }
    const uc = e.target.closest('[data-use-comp]'); if (uc) { state.target = uc.dataset.useComp; save(); closeModal(); showTab('board'); scrollToTarget(); return; }
    const u = e.target.closest('[data-unit]'); if (u) { unitDetail(u.dataset.unit); return; }
    const it = e.target.closest('[data-item]'); if (it && !e.target.closest('#component-picker')) { itemDetail(it.dataset.item); return; }
    const tr = e.target.closest('[data-trait]');
    if (tr) { const t = T.get(tr.dataset.trait); if (t) openModal(traitCard(t)); }
  });

  let start = 'board'; try { start = localStorage.getItem('tft-helper-tab') || 'board'; } catch {}
  showTab(start);
}
init();
})();
