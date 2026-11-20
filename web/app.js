/* TFT Helper — chạy thẳng trong trình duyệt, dữ liệu ở data.js (tạo bởi scripts/update-data.mjs). */
(() => {
'use strict';
const D = window.TFT_DATA;
if (!D) { document.body.innerHTML = '<p style="padding:20px">Chưa có dữ liệu. Chạy: <code>node scripts/update-data.mjs</code></p>'; return; }

// =====================================================================
// Chỉ mục + trạng thái
// =====================================================================
const U = new Map(D.units.map(u => [u.id, u]));
const T = new Map(D.traits.map(t => [t.id, t]));
const I = new Map(D.items.map(i => [i.id, i]));
const A = new Map(D.augments.map(a => [a.id, a]));
const COMPONENTS = D.items.filter(i => i.kind === 'component');
const RECIPE = new Map(); // "a|b" (đã sắp xếp) -> item
D.items.filter(i => i.from.length === 2 && ['craftable', 'emblem', 'support'].includes(i.kind))
  .forEach(i => RECIPE.set([...i.from].sort().join('|'), i));
const unitTraits = u => u.traits.map(id => T.get(id)).filter(Boolean);
const COMP_BY_ID = new Map(D.comps.map(c => [c.id, c]));
const LEVELS = [...new Set(D.comps.map(c => c.levellingVi))];
const COSTS = [...new Set(D.units.map(u => u.cost))].sort((a, b) => a - b);
const ROUNDS = ['1-2', '1-3', '1-4'];
for (let s = 2; s <= 7; s++) for (let r = 1; r <= 7; r++) ROUNDS.push(`${s}-${r}`);

const KEY = 'tft-helper-state-v1';
const state = Object.assign(
  { mine: [], contested: [], comps: {}, augs: [], augAt: {}, unlocked: [], done: [], stage: '', level: 5, gold: 20, hp: 100, target: null },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
// 7 nhà khác. Dữ liệu "Nhà khác tranh" cũ (state.contested) chuyển vào Nhà 1.
const newOpponents = (first = []) => Array.from({ length: 7 }, (_, i) => ({ name: 'Nhà ' + (i + 1), units: i === 0 ? [...first] : [] }));
if (!Array.isArray(state.opponents) || state.opponents.length !== 7) state.opponents = newOpponents(state.contested || []);
if (!(state.activeOpp >= 0 && state.activeOpp < 7)) state.activeOpp = 0;
function syncContested() { state.contested = [...new Set(state.opponents.flatMap(o => o.units))]; }
syncContested();
// Bộ lọc giao diện (không lưu)
const ui = { pathLevel: null, pathAlt: false, posFull: false, poolCost: 0, compLevel: '', unitCost: 0, unitTrait: '', traitType: '', itemKind: 'craftable', augRarity: '', augTag: '' };

// =====================================================================
// Tiện ích
// =====================================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const fmt = (n, d = 2) => n == null ? '–' : Number(n).toFixed(d);
const pct = n => n == null ? '–' : (n * 100).toFixed(1) + '%';
const uname = id => U.get(id)?.name || id;
const thumb = (url, w = 96) => `https://cdn.metatft.com/cdn-cgi/image/width=${w},height=${w},format=auto/${url}`;
const short = (s, n = 220) => { s = String(s || ''); return s.length > n ? s.slice(0, n).trimEnd() + '…' : s; };
const RARITY_VI = { Silver: 'Bạc', Gold: 'Vàng', Prismatic: 'Kim Cương' };
const TYPE_VI = { origin: 'Tộc', class: 'Hệ', unique: 'Riêng' };
const TAG_VI = { econ: 'Kinh tế', combat: 'Giao tranh', items: 'Trang bị', trait: 'Tộc hệ', scaling: 'Tăng dần', misc: 'Khác' };
const KIND_VI = { craftable: 'Đồ ghép', component: 'Mảnh', emblem: 'Ấn', artifact: 'Tạo tác', radiant: 'Ánh Sáng', support: 'Hỗ trợ', other: 'Khác' };

// ---------- Biểu tượng ----------
function uIcon(id, opt = {}) {
  const u = U.get(id);
  if (!u) return '';
  const cls = ['u', 'c' + u.cost, opt.size || '', opt.dim ? 'dim' : '', opt.owned ? 'owned' : '', opt.contested ? 'contested' : ''].join(' ');
  const attr = opt.attr || `data-unit="${esc(id)}"`;
  return `<span class="${cls}" ${attr}><span class="fb">${esc(u.name)}</span>` +
    `<img src="${esc(thumb(u.icon))}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` +
    `${opt.badge ? `<span class="badge ${opt.badgeCls || ''}">${opt.badge}</span>` : ''}` +
    `${u.unlock && !state.unlocked.includes(id) ? '<span class="lock">🔒</span>' : ''}</span>`;
}
function iIcon(id, size = '') {
  const i = I.get(id);
  if (!i) return '';
  return `<img class="it ${size}" data-item="${esc(id)}" src="${esc(i.icon)}" alt="${esc(i.name)}" loading="lazy" onerror="this.style.visibility='hidden'">`;
}
function tChip(id, extra = '', cls = '') {
  const t = T.get(id);
  if (!t) return '';
  return `<span class="tchip ${cls}" data-trait="${esc(id)}"><img src="${esc(t.icon)}" alt="" onerror="this.remove()">${esc(t.name)}${extra ? ' ' + extra : ''}</span>`;
}
function augChip(a, extraCls = '', removable = -1) {
  return `<span class="aug ${esc(a.rarity)} ${extraCls}" data-aug="${esc(a.id)}"><img src="${esc(a.icon)}" alt="" onerror="this.remove()">${esc(a.name)}${removable >= 0 ? `<span class="x" data-rm-aug="${removable}">✕</span>` : ''}</span>`;
}
function unitCell(id, items = [], opt = {}) {
  return `<span class="ucell ${opt.carry ? 'carry' : ''}">${uIcon(id, opt)}<span class="items">${items.map(x => iIcon(x)).join('')}</span><span class="uname">${esc(uname(id))}</span></span>`;
}
function compUnitsRow(c, opt = {}) {
  const mine = opt.mine, cont = opt.cont;
  return `<div class="units-row">${c.units.map(u => {
    const b = c.builds.find(x => x.unit === u);
    return unitCell(u, b ? b.items : [], { carry: !!b, owned: mine?.has(u), contested: cont?.has(u), dim: opt.dimMissing && !mine?.has(u) });
  }).join('')}</div>`;
}
const chipsHtml = (opts, cur, extraCls = () => '') =>
  opts.map(([v, label]) => `<span class="chip ${String(v) === String(cur) ? 'on' : ''} ${extraCls(v)}" data-v="${esc(v)}">${label}</span>`).join('');

// =====================================================================
// Logic: tộc hệ, chia mảnh, chấm điểm, nhịp chơi, mã đội
// =====================================================================
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
    tChip(x.id, `<span class="n">${x.n}</span>${x.next ? '<span class="muted">/' + x.next.min + '</span>' : ''}`, x.on ? 'st' + (x.on.style || 1) : 'off')).join('');
}

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
  const ui2 = D.unitItems[unitId];
  if (!ui2) return [];
  return ui2.items.slice(0, 8).map((x, i) => ({ item: x.id, unit: unitId, w: 10 - i }));
}
const recipeHtml = item => `<span class="recipe">${iIcon(item.from[0])}+${iIcon(item.from[1])} → ${iIcon(item.id, 'md')} ${esc(item.name)}</span>`;

// Đoán đội của một nhà từ các tướng đã đánh dấu (cần ít nhất 2 tướng khớp).
function guessComp(units) {
  if (!units || units.length < 2) return null;
  let best = null;
  for (const c of D.comps) {
    const hit = c.units.filter(u => units.includes(u));
    if (hit.length < 2) continue;
    const sc = hit.reduce((t, u) => t + 1 + (U.get(u)?.cost || 1) * 0.5, 0) + c.carries.filter(u => units.includes(u)).length * 2 + Math.log10((c.count || 0) + 1) * 0.3;
    if (!best || sc > best.sc) best = { c, hit, sc };
  }
  return best;
}
const lobby = () => state.opponents.map((o, i) => ({ i, o, g: guessComp(o.units) }));
// d > 0: sảnh làm hạng của đội c tệ đi; d < 0: tốt lên (số liệu MetaTFT "counters").
function lobbyImpact(c, L = lobby()) {
  let d = 0; const parts = [];
  for (const l of L) {
    if (!l.g) continue;
    const x = l.g.c.id === c.id ? { d: c.selfMirror ?? 0.8, s: 1 } : (c.counters || []).find(k => k.id === l.g.c.id);
    if (!x) continue;
    d += x.d; parts.push({ ...l, d: x.d, s: x.s });
  }
  return { d, parts };
}
let _lobbyCache = null, _lobbyKey = '';
function LOBBY() { const k = JSON.stringify(state.opponents); if (k !== _lobbyKey) { _lobbyKey = k; _lobbyCache = lobby(); } return _lobbyCache; }
const holders = id => state.opponents.filter(o => o.units.includes(id)).length;
const signed = d => (d > 0 ? '+' : '') + d.toFixed(2);

function scoreComp(c, L) {
  const mine = new Set(state.mine), cont = new Set(state.contested);
  let s = 0; const why = [];
  const have = c.units.filter(u => mine.has(u));
  have.forEach(u => s += 1 + (U.get(u)?.cost || 1) * 0.5);
  const carriesHave = c.carries.filter(u => mine.has(u));
  s += carriesHave.length * 2;
  if (have.length) why.push(`👥 ${have.length}/${c.units.length}`);
  if (carriesHave.length) why.push(`⭐ ${carriesHave.map(uname).join(', ')}`);
  const contHit = c.units.filter(u => cont.has(u));
  contHit.forEach(u => s -= 1 + (U.get(u)?.cost || 1) * 0.4 + (c.carries.includes(u) ? 2 : 0));
  if (contHit.length) why.push(`<span class="bad">⚔ tranh ${contHit.map(uname).join(', ')}</span>`);
  if (compTotal(state.comps)) {
    const { pick } = solveItems(state.comps, compTargets(c));
    s += pick.length * 1.5;
    if (pick.length) why.push(`🧩 ${pick.length} món`);
  }
  const augTraits = new Set(state.augs.flatMap(a => A.get(a)?.traits || []));
  if (c.traits.some(t => augTraits.has(t.id))) { s += 3; why.push('✨ hợp lõi'); }
  if (c.avg != null) s += (4.5 - c.avg) * 2;
  const li = lobbyImpact(c, L);
  if (li.parts.length) {
    s -= li.d * 2;
    if (Math.abs(li.d) >= 0.1) why.push(`<span class="${li.d > 0 ? 'bad' : 'good'}">🏟 sảnh ${signed(li.d)}</span>`);
  }
  return { c, s, why };
}

// Dòng gợi ý ngắn: {ic, html, cls}
function tempoLines(target) {
  const out = [];
  const [st, rd] = String(state.stage || '').split('-').map(Number);
  const lvl = Number(state.level) || 0, gold = Number(state.gold) || 0, hp = Number(state.hp) || 100;
  const LEVEL_PLAN = [['2-1', 4], ['2-5', 5], ['3-2', 6], ['4-1', 7], ['4-2', 8], ['5-1', 9]];
  const interest = Math.min(5, Math.floor(gold / 10));
  if (gold < 50) out.push({ ic: '💰', html: `Lãi <b>+${interest}</b> · thêm <b>${10 - (gold % 10)}</b> vàng → +${interest + 1}` });
  else out.push({ ic: '💰', html: `Lãi tối đa +5 · dư <b>${gold - 50}</b> vàng để lên cấp / roll` });
  if (hp <= 30) out.push({ ic: '❤️', html: 'Máu thấp: roll / lên cấp ngay để giữ máu', cls: 'bad' });
  else if (hp <= 50) out.push({ ic: '❤️', html: 'Máu vừa: tiêu phần vàng trên 50 để mạnh lên' });
  const m = target && /lvl (\d)/.exec(target.levelling || '');
  if (st && !(m && lvl >= Number(m[1]))) {
    const due = LEVEL_PLAN.filter(([r]) => { const [a, b] = r.split('-').map(Number); return st > a || (st === a && (rd || 1) >= b); }).at(-1);
    if (due && lvl < due[1]) out.push({ ic: '⬆️', html: `Mốc ${due[0]}: nên ở <b>cấp ${due[1]}</b> (đang ${lvl})` });
  }
  if (target) {
    const L = target.levelling || '';
    if (m) {
      const n = Number(m[1]);
      out.push({ ic: '🔁', html: `Reroll <b>cấp ${n}</b>: roll phần vàng trên 50 tới khi chủ lực 3★` });
      if (lvl < n) out.push({ ic: '⬆️', html: `Lên <b>cấp ${n}</b> trước rồi mới roll` });
    } else if (/Fast 9/.test(L)) out.push({ ic: '⏩', html: 'Lên nhanh: <b>cấp 8</b> ở 4-1/4-2, ổn định bàn, rồi <b>cấp 9</b> tìm tướng 5 vàng' });
    else if (/Fast 8/.test(L)) out.push({ ic: '⏩', html: 'Giữ vàng, <b>cấp 8</b> ở 4-1, roll tìm tướng 4 vàng' });
    else out.push({ ic: '📈', html: '<b>Cấp 7</b> ở 3-5/4-1, <b>cấp 8</b> ở 4-2 rồi roll' });
  }
  return out;
}
const linesHtml = arr => `<ul class="lines">${arr.map(l => `<li class="${l.cls || ''}"><span class="ic">${l.ic}</span><span>${l.html}</span></li>`).join('')}</ul>`;

// Mã đội: "02" + 10 ô × mã 3 ký tự ("000" = trống) + tên Set (vd TFTSet19).
function teamCode(unitIds) {
  const list = [...new Set(unitIds)].map(id => U.get(id)).filter(Boolean);
  const ok = list.filter(u => u.code);
  let code = '02';
  for (let i = 0; i < 10; i++) code += ok[i] ? ok[i].code : '000';
  code += D.meta.setKey || ('TFTSet' + D.meta.set);
  return { code, skipped: list.filter(u => !u.code), over: ok.slice(10) };
}
function toast(html, ms = 6000) {
  const el = $('#toast');
  el.innerHTML = html; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
async function copyTeam(unitIds, label) {
  if (!unitIds.length) { toast('Chưa có tướng nào để tạo mã.', 2500); return; }
  const { code, skipped, over } = teamCode(unitIds);
  const ok = await copyText(code);
  let msg = ok ? `✅ Đã copy mã ${esc(label)}. Trong game: <b>Team Planner → Import → dán</b>.` : 'Không copy tự động được, bôi đen mã dưới đây rồi Ctrl+C.';
  msg += `<div class="code">${esc(code)}</div>`;
  if (skipped.length) msg += `<div class="bad">Bỏ qua (chưa có mã đúng): ${skipped.map(u => esc(u.name)).join(', ')}</div>`;
  if (over.length) msg += `<div class="bad">Quá 10 tướng, bỏ: ${over.map(u => esc(u.name)).join(', ')}</div>`;
  toast(msg);
}
const copyBtn = (key, cls = 'icon-btn') => `<button class="${cls}" data-copy="${esc(key)}" data-tip-text="Copy mã đội để dán vào Team Planner trong game">📋</button>`;

// ---------- Phân tích đội đang nhắm ----------
const RARITY_ORDER = { Prismatic: 0, Gold: 1, Silver: 2 };
function targetAnalysis(c) {
  const mine = new Set(state.mine), cont = new Set(state.contested);
  const w = id => 1 + (U.get(id)?.cost || 1) * 0.5;
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
  const verdict = match >= 55 ? ['good', 'Hợp'] : match >= 30 ? ['warn', 'Tạm được'] : ['bad', 'Chưa hợp'];
  return { mine, cont, have, missing, carries, carriesHave, contested, pick, left, match, verdict, empty, hasComps };
}
function itemRows(c, a) {
  const picked = new Map(); // đếm số lần mỗi món được chọn (một tướng có thể cần 2 món giống nhau)
  a.pick.forEach(p => { const k = p.unit + '|' + p.item; picked.set(k, (picked.get(k) || 0) + 1); });
  const takePicked = k => { const n = picked.get(k) || 0; if (n > 0) { picked.set(k, n - 1); return true; } return false; };
  const need = {};
  const pool = { ...a.left };
  const rows = c.builds.map(b => {
    const cells = b.items.map(it => {
      const item = I.get(it);
      if (!item) return '';
      if (takePicked(b.unit + '|' + it)) return `<span class="istat ok">${iIcon(it, 'md')}<span class="st">✔ ghép ngay</span></span>`;
      if (item.from.length !== 2) return `<span class="istat">${iIcon(it, 'md')}</span>`;
      const miss = [];
      item.from.forEach(p => { if ((pool[p] || 0) > 0) pool[p]--; else miss.push(p); });
      miss.forEach(p => need[p] = (need[p] || 0) + 1);
      if (a.hasComps && miss.length === 1) return `<span class="istat warn">${iIcon(it, 'md')}<span class="st">thiếu</span>${iIcon(miss[0])}</span>`;
      return `<span class="istat no">${iIcon(it, 'md')}${iIcon(item.from[0])}${iIcon(item.from[1])}</span>`;
    }).join('');
    return `<div class="build-row"><span class="who">${uIcon(b.unit, { size: 'sm', owned: a.mine.has(b.unit) })}${esc(uname(b.unit))}</span>${cells}</div>`;
  }).join('');
  return { rows, needList: Object.entries(need).sort((x, y) => y[1] - x[1]) };
}
function augmentsFor(c) {
  const traitIds = new Set(activeTraits(c.units).filter(x => x.on).map(x => x.id));
  return D.augments.filter(a => a.traits.some(t => traitIds.has(t)))
    .sort((x, y) => (RARITY_ORDER[x.rarity] ?? 3) - (RARITY_ORDER[y.rarity] ?? 3) || x.name.localeCompare(y.name));
}
function augmentHint(c) {
  const L = c.levelling || '';
  if (/lvl \d/.test(L)) return '2-1: kinh tế / reroll · 3-2, 4-2: giao tranh hoặc lõi tộc hệ';
  if (/Fast/.test(L)) return '2-1: kinh tế / kinh nghiệm · sau đó: giao tranh hoặc lõi đồ';
  return 'Giao tranh hoặc lõi đồ cho chủ lực · kinh tế nếu đang giữ chuỗi';
}

// =====================================================================
// Tab Tình huống
// =====================================================================
function stepperDefs() {
  return [
    { key: 'stage', label: 'Vòng', val: state.stage || '–' },
    { key: 'level', label: 'Cấp', val: state.level },
    { key: 'gold', label: 'Vàng', val: state.gold },
    { key: 'hp', label: 'Máu', val: state.hp },
  ];
}
function renderSteppers() {
  const hp = Number(state.hp);
  $('#steppers').innerHTML = stepperDefs().map(s => `<div class="stepper ${s.key === 'hp' ? 'hp ' + (hp <= 30 ? 'low' : hp <= 50 ? 'mid' : '') : ''}" data-step="${s.key}">
    <label>${s.label}</label><div class="row"><button data-dir="-1" data-tip-text="Bớt (Shift: ×5)">−</button><input value="${esc(s.val)}" ${s.key === 'stage' ? 'placeholder="3-2"' : 'inputmode="numeric"'}><button data-dir="1" data-tip-text="Thêm (Shift: ×5)">+</button></div></div>`).join('');
}
function stepValue(key, dir, mult) {
  if (key === 'stage') {
    const i = ROUNDS.indexOf(state.stage);
    state.stage = ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, (i < 0 ? ROUNDS.indexOf('2-1') - (dir > 0 ? 1 : 0) : i) + dir * mult))];
    return;
  }
  const lim = { level: [1, 10], gold: [0, 300], hp: [0, 100] }[key];
  state[key] = Math.max(lim[0], Math.min(lim[1], (Number(state[key]) || 0) + dir * mult));
}

function renderTrays() {
  const counts = {};
  state.mine.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const uniq = Object.keys(counts);
  $('#mine-count').textContent = state.mine.length ? `· ${uniq.length} tướng` : '';
  $('#mine-list').innerHTML = uniq.length ? uniq.sort((a, b) => (U.get(a)?.cost || 0) - (U.get(b)?.cost || 0))
    .map(id => uIcon(id, { attr: `data-rm-mine="${esc(id)}" data-tipunit="${esc(id)}"`, badge: counts[id] > 1 ? '×' + counts[id] : '' })).join('')
    : '<span class="empty">Bấm tướng ở bảng bên dưới để thêm. Bấm vào tướng ở đây để bỏ.</span>';
  renderOpps();
}
function renderOpps() {
  const L = LOBBY();
  $('#opp-list').innerHTML = state.opponents.map((o, i) => {
    const g = L[i].g;
    return `<div class="opp ${i === state.activeOpp ? 'on' : ''}" data-opp="${i}">
      <span class="oname" data-opp-name="${i}" data-tip-text="Bấm để chọn nhà · bấm đúp để đổi tên · phím ${i + 1}">${i + 1}. ${esc(o.name)}</span>
      <span class="ounits">${o.units.map(id => uIcon(id, { size: 'xs', attr: `data-rm-opp="${i}|${esc(id)}" data-tipunit="${esc(id)}"` })).join('') || `<span class="empty">${i === state.activeOpp ? 'bấm phải vào tướng để thêm' : '—'}</span>`}</span>
      ${g ? `<span class="oguess" data-comp-detail="${esc(g.c.id)}" data-tip-text="Tool đoán nhà này chơi đội này (${g.hit.length} tướng khớp). Bấm để xem.">≈ ${esc(g.c.name)}</span>` : ''}
    </div>`;
  }).join('');
}
function renderComponents() {
  $('#component-picker').innerHTML = COMPONENTS.map(c => {
    const n = state.comps[c.id] || 0;
    return `<div class="comp-btn ${n ? 'has' : ''}" data-comp="${esc(c.id)}" data-tipitem="${esc(c.id)}">${n ? `<span class="cnt">${n}</span>` : ''}<img src="${esc(c.icon)}" alt=""></div>`;
  }).join('');
}
function renderAugChosen() {
  $('#aug-chosen').innerHTML = state.augs.map((id, i) => A.get(id) ? augChip(A.get(id), '', i) : '').join('');
}
function poolMatches() {
  const q = norm($('#board-unit-search').value);
  return D.units.filter(u => (!ui.poolCost || u.cost === ui.poolCost) &&
    (!q || norm(u.name).includes(q) || norm(u.nameEn).includes(q) || unitTraits(u).some(t => norm(t.name).includes(q) || norm(t.nameEn).includes(q))))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}
function renderPool() {
  $('#cost-filter').innerHTML = chipsHtml([[0, 'Tất cả'], ...COSTS.map(c => [c, c + ' 💰'])], ui.poolCost, v => v ? 'cost' + v : '');
  const list = poolMatches();
  let last = null, h = '';
  list.forEach(u => {
    if (u.cost !== last && !ui.poolCost) { h += `<div class="sep">${u.cost} vàng</div>`; last = u.cost; }
    h += `<div class="tile" data-pick="${esc(u.id)}">${uIcon(u.id, { attr: `data-tipunit="${esc(u.id)}"` })}<span class="nm">${esc(u.name)}</span></div>`;
  });
  $('#board-unit-pool').innerHTML = h || '<span class="empty">Không có tướng nào khớp.</span>';
  markPool();
}
function markPool() {
  const counts = {}; state.mine.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const cont = new Set(state.contested);
  document.querySelectorAll('#board-unit-pool .tile').forEach(t => {
    const id = t.dataset.pick, u = t.querySelector('.u');
    t.classList.toggle('picked', !!counts[id]); t.classList.toggle('contested', cont.has(id));
    u.classList.toggle('owned', !!counts[id]); u.classList.toggle('contested', cont.has(id));
    let b = u.querySelector('.badge');
    if (counts[id]) { if (!b) { b = document.createElement('span'); b.className = 'badge'; u.appendChild(b); } b.textContent = counts[id] > 1 ? '×' + counts[id] : '✓'; }
    else if (b) b.remove();
    const h = holders(id); let hb = u.querySelector('.hbadge');
    if (h >= 1) { if (!hb) { hb = document.createElement('span'); hb.className = 'hbadge'; u.appendChild(hb); } hb.textContent = h; hb.title = h + ' nhà đang giữ'; }
    else if (hb) hb.remove();
  });
}

function suggCard(r, opt = {}) {
  const c = r.c;
  const a = opt.analysis;
  const mine = new Set(state.mine), cont = new Set(state.contested);
  return `<div class="card sugg">
    <span class="tier ${esc(c.tier)}">${esc(c.tier)}</span>
    <div class="info">
      <div class="name">${esc(c.name)} <span class="pill">${esc(c.levellingVi)}</span> <span class="pill">hạng TB <b>${fmt(c.avg)}</b></span></div>
      ${a && !a.empty ? `<div class="mini"><div class="mbar ${a.verdict[0]}"><i style="width:${a.match}%"></i></div><span class="verdict ${a.verdict[0]}" style="font-size:12.5px">${a.match}%</span><span class="why">${r.why.join(' · ')}</span></div>` : ''}
      ${compUnitsRow(c, { mine, cont, dimMissing: a && !a.empty })}
    </div>
    <div class="icons" style="flex-direction:column;gap:6px">
      <button class="btn primary" data-set-target="${esc(c.id)}">🎯 Nhắm</button>
      <span class="icons">${copyBtn('comp:' + c.id)}<button class="icon-btn" data-comp-detail="${esc(c.id)}" data-tip-text="Xem chi tiết">ⓘ</button></span>
    </div>
  </div>`;
}

// ---------- Lộ trình theo cấp ----------
const pathLevels = c => Object.keys(c.path || {}).map(Number).sort((a, b) => a - b);
function pathBoardHtml(b, mine, opt = {}) {
  const have = b.units.filter(u => mine.has(u));
  const missing = b.units.filter(u => !mine.has(u));
  const track = mine.size > 0;
  return `<div class="pboard ${opt.alt ? 'alt' : ''}">
    <div class="units-row">${b.units.map(u => unitCell(u, [], { owned: track && mine.has(u), dim: track && !mine.has(u), size: opt.alt ? 'sm' : '' })).join('')}</div>
    <div class="icons pmeta">
      ${opt.label ? `<span class="pill">${opt.label}</span>` : ''}
      <span class="pill">hạng TB <b>${fmt(b.avg)}</b></span>
      ${b.win != null ? `<span class="pill">thắng vòng <b>${Math.round(b.win * 100)}%</b></span>` : ''}
      <span class="pill">${(b.count || 0).toLocaleString('vi-VN')} trận</span>
      ${track ? `<span class="pill ${missing.length ? '' : 'good'}">${missing.length ? `có <b>${have.length}/${b.units.length}</b> · thiếu ${missing.map(uname).map(esc).join(', ')}` : '✔ đủ tướng'}</span>` : ''}
      <button class="icon-btn" data-copy="units:${esc(b.units.join(','))}" data-tip-text="Copy mã bàn này để dán vào Team Planner">📋</button>
    </div></div>`;
}
function levelPathCard(c, mine) {
  const levels = pathLevels(c);
  if (!levels.length) return '';
  const myLvl = Number(state.level) || 0;
  const auto = levels.includes(myLvl) ? myLvl : myLvl < levels[0] ? levels[0] : levels.filter(l => l <= myLvl).at(-1) ?? levels[0];
  const L = levels.includes(ui.pathLevel) ? ui.pathLevel : auto;
  const lv = c.path[L];
  const [main, ...alts] = lv.boards;
  return `<div class="card" id="level-path"><div class="card-title">🪜 Lộ trình theo cấp <span class="hint-inline" data-tip-text="Bàn cờ hay được đặt ở từng cấp khi chơi đội này (số liệu MetaTFT). Viền xanh = bạn đã có, mờ = còn thiếu.">ⓘ</span></div>
    <div class="chips lvl-chips">${levels.map(l => `<span class="chip ${l === L ? 'on' : ''}" data-path-level="${l}">Cấp ${l}${c.path[l].stage ? ` <small>· ${esc(c.path[l].stage)}</small>` : ''}${l === myLvl ? ' •' : ''}</span>`).join('')}</div>
    <div class="sub-title">Cấp ${L}${lv.stage ? ` · thường lên cấp này ở vòng <b>${esc(lv.stage)}</b>` : ''}${L === myLvl ? ' · <span class="good">cấp hiện tại của bạn</span>' : ''}</div>
    ${pathBoardHtml(main, mine, { label: 'Bàn chính' })}
    ${alts.length ? `<button class="btn ghost" data-path-alt="1">${ui.pathAlt ? '▲ Ẩn bàn thay thế' : `▼ Xem ${alts.length} bàn thay thế`}</button>
      ${ui.pathAlt ? alts.map((b, i) => pathBoardHtml(b, mine, { alt: true, label: 'Thay thế ' + (i + 1) })).join('') : ''}` : ''}
    ${c.positions ? `<div class="sub-title">📍 Xếp vị trí ${ui.posFull ? '— <b>bàn đủ đội</b>' : `— <b>bàn chính cấp ${L}</b>`}
        <button class="btn ghost" data-pos-full="1">${ui.posFull ? `Xem bàn cấp ${L}` : 'Xem bàn đủ đội'}</button></div>
      ${hexBoardHtml(c, ui.posFull ? c.units : main.units, mine)}` : ''}
  </div>`;
}

function lobbyCard(c) {
  const L = LOBBY();
  const known = L.filter(l => l.o.units.length);
  if (!known.length) return '';
  const li = lobbyImpact(c, L);
  const tone = li.d > 0.15 ? 'bad' : li.d < -0.15 ? 'good' : '';
  const exp = c.avg != null ? c.avg + li.d : null;
  const best = D.comps.filter(x => x.tier !== '?' && x.avg != null).map(x => ({ x, e: x.avg + lobbyImpact(x, L).d })).sort((a, b) => a.e - b.e)[0];
  const ours = new Set(c.units);
  return `<div class="card lobby ${tone === 'bad' ? 'hot' : ''}"><div class="card-title">🏟 Sảnh đấu
      <span class="pill ${tone}">${li.parts.length ? `${signed(li.d)} hạng ${li.d > 0.15 ? '(tệ hơn)' : li.d < -0.15 ? '(tốt hơn)' : '(không đáng kể)'}` : 'chưa đoán được đội nhà nào'}</span>
      ${exp != null && li.parts.length ? `<span class="pill">hạng dự kiến <b>${fmt(exp)}</b></span>` : ''}</div>
    ${known.map(l => {
      const part = li.parts.find(p => p.i === l.i);
      const clash = l.o.units.filter(u => ours.has(u));
      return `<div class="lrow"><span class="lname">${esc(l.o.name)}</span>
        <span class="lguess">${l.g ? `<a href="#" data-comp-detail="${esc(l.g.c.id)}">${esc(l.g.c.name)}</a> <span class="muted">(${l.g.hit.length} tướng khớp)</span>` : '<span class="muted">chưa đoán được (cần ≥2 tướng của một đội)</span>'}</span>
        ${part ? `<span class="pill ${part.d > 0.1 ? 'bad' : part.d < -0.1 ? 'good' : ''}">${signed(part.d)}</span>` : ''}
        ${clash.length ? `<span class="pill bad">⚔ tranh ${clash.map(uname).map(esc).join(', ')}</span>` : ''}</div>`;
    }).join('')}
    ${best && best.x.id !== c.id && exp != null && best.e < exp - 0.15 ? `<div class="lbest">💡 Đội hợp sảnh này nhất: <b>${esc(best.x.name)}</b> <span class="pill">hạng dự kiến <b>${fmt(best.e)}</b></span> <button class="btn primary" data-set-target="${esc(best.x.id)}">🎯 Nhắm</button></div>` : ''}
  </div>`;
}

// ---------- Xếp vị trí: bàn lục giác 4 hàng × 7 ô ----------
// cell n (1..28): hàng f = floor((n-1)/7) với f = 0 là hàng cuối, cột = (n-1) % 7.
function hexBoardHtml(c, unitIds, mine) {
  const pos = c.positions || {};
  const taken = new Map(), none = [];
  [...new Set(unitIds)].sort((a, b) => (pos[b]?.[0]?.n || 0) - (pos[a]?.[0]?.n || 0)).forEach(u => {
    const cell = (pos[u] || []).map(p => p.cell).find(x => !taken.has(x));
    if (cell) taken.set(cell, u); else none.push(u);
  });
  const track = mine && mine.size > 0;
  let h = '<div class="hexb"><div class="hlabel">▲ Hàng đầu (phía địch)</div>';
  for (let f = 3; f >= 0; f--) {
    h += `<div class="hrow ${(3 - f) % 2 ? 'off' : ''}">`;
    for (let col = 0; col < 7; col++) {
      const u = taken.get(f * 7 + col + 1);
      h += `<div class="hex ${u ? 'has' : ''}">${u ? uIcon(u, { size: 'sm', owned: track && mine.has(u), dim: track && !mine.has(u) }) : ''}</div>`;
    }
    h += '</div>';
  }
  h += '<div class="hlabel">▼ Hàng cuối</div></div>';
  if (none.length) h += `<div class="sub-title">Chưa có số liệu vị trí: ${none.map(uname).map(esc).join(', ')}</div>`;
  return h;
}

function renderTargetView(c) {
  const a = targetAnalysis(c);
  const ranked = D.comps.map(c => scoreComp(c, LOBBY())).sort((x, y) => y.s - x.s);
  const self = ranked.find(r => r.c.id === c.id);
  const better = ranked.filter(r => r.c.id !== c.id && self && r.s > self.s + 3).slice(0, 3);
  const [st] = String(state.stage || '').split('-').map(Number);
  const items = itemRows(c, a);
  const augs = augmentsFor(c);
  const myAugs = new Set(state.augs);
  const keep = new Set([...c.units, ...c.extraUnits]);
  const sell = [...new Set(state.mine)].filter(u => !keep.has(u));
  const reroll = /lvl (\d)/.exec(c.levelling || '');
  const buyOrder = [...a.missing].sort((x, y) => ((a.carries.includes(y) - a.carries.includes(x)) * (reroll ? 1 : 0)) || (U.get(x)?.cost || 0) - (U.get(y)?.cost || 0));
  const locked = buyOrder.filter(u => U.get(u)?.unlock && !state.unlocked.includes(u));
  const traitNow = activeTraits(state.mine);
  const traitGoal = activeTraits(c.units).filter(x => x.on).map(x => {
    const now = traitNow.find(y => y.id === x.id)?.n || 0;
    return `<span class="tprog ${now >= x.n ? 'done' : ''}" data-trait="${esc(x.id)}"><img src="${esc(x.t.icon)}" alt="" onerror="this.remove()">${esc(x.t.name)} <b>${now}/${x.n}</b><span class="bar"><i style="width:${Math.min(100, now / x.n * 100)}%"></i></span></span>`;
  }).join('');
  const starLine = reroll
    ? { ic: '⭐', html: `Chủ lực cần <b>3★</b>: ${(a.carries.filter(u => (U.get(u)?.cost || 9) <= Number(reroll[1]) - 2).length ? a.carries.filter(u => (U.get(u)?.cost || 9) <= Number(reroll[1]) - 2) : a.carries).map(uname).join(', ')}. Giữ mọi bản sao.` }
    : { ic: '⭐', html: `Chủ lực cần <b>2★</b>: ${a.carries.map(uname).join(', ')}` };
  const todo = [...tempoLines(c), starLine];
  if (st && st <= 2 && !a.empty && a.match < 55) todo.push({ ic: 'ⓘ', html: '<span class="muted">Đầu trận khớp thấp là bình thường: giữ tướng rẻ cùng tộc hệ.</span>' });

  const pills = [];
  if (!a.empty) {
    pills.push(`<span class="pill">👥 <b>${a.have.length}/${c.units.length}</b> tướng</span>`);
    a.carries.forEach(u => pills.push(`<span class="pill ${a.mine.has(u) ? 'good' : ''}">${a.mine.has(u) ? '✔' : '✖'} ${esc(uname(u))}</span>`));
    if (a.hasComps) pills.push(`<span class="pill ${a.pick.length ? 'good' : ''}">🧩 <b>${a.pick.length}</b> món ghép ngay</span>`);
    if (a.contested.length) pills.push(`<span class="pill bad">⚔ bị tranh: ${a.contested.map(uname).join(', ')}</span>`);
  }
  const liHero = lobbyImpact(c, LOBBY());
  if (liHero.parts.length && Math.abs(liHero.d) >= 0.1) pills.push(`<span class="pill ${liHero.d > 0 ? 'bad' : 'good'}">🏟 sảnh ${signed(liHero.d)} hạng</span>`);

  return `<div class="card hero" id="target-hero">
      <div class="hero-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><span class="name">🎯 ${esc(c.name)}</span>
        <span class="pill">${esc(c.levellingVi)}</span><span class="pill">hạng TB <b>${fmt(c.avg)}</b></span><span class="spacer"></span>
        <button class="btn" data-copy="comp:${esc(c.id)}">📋 Copy mã</button>
        <button class="icon-btn" data-comp-detail="${esc(c.id)}" data-tip-text="Xem chi tiết">ⓘ</button>
        <button class="icon-btn" data-untarget="1" data-tip-text="Bỏ nhắm">✕</button></div>
      ${a.empty
        ? `<div class="match"><span class="muted">Chọn tướng và mảnh đồ đang có (cột trái) để đo mức khớp.</span></div>`
        : `<div class="match"><span class="verdict ${a.verdict[0]}">${a.verdict[1]}</span><div class="mbar ${a.verdict[0]}"><i style="width:${a.match}%"></i></div><b>${a.match}%</b> ${pills.join(' ')}</div>`}
      ${compUnitsRow(c, { mine: a.mine, cont: a.cont, dimMissing: !a.empty })}
      <div style="margin-top:8px">${traitGoal}</div>
    </div>
    ${lobbyCard(c)}
    ${levelPathCard(c, a.mine)}
    <div class="cards2">
      <div class="card"><div class="card-title">📋 Việc cần làm</div>${linesHtml(todo)}</div>
      <div class="card"><div class="card-title">🛒 Mua / bán</div>
        <div class="sub-title">Mua theo thứ tự</div>
        <div class="icons">${buyOrder.map(u => uIcon(u, { size: 'sm', contested: a.cont.has(u), badge: holders(u) ? '⚔' + holders(u) : '', badgeCls: 'bad' })).join('') || '<span class="good">Đã đủ tướng 👍</span>'}</div>
        ${locked.length ? `<div class="sub-title">🔒 Cần mở khoá</div><ul class="lines">${locked.map(u => `<li><span class="ic">${uIcon(u, { size: 'sm' })}</span><span><b>${esc(uname(u))}</b>${U.get(u).unlockLevel ? ' · từ cấp ' + U.get(u).unlockLevel : ''}<br><span class="muted">${esc(U.get(u).unlock)}</span></span></li>`).join('')}</ul>` : ''}
        ${sell.length ? `<div class="sub-title">Có thể bán (không thuộc đội)</div><div class="icons">${sell.map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}
        ${c.extraUnits.length ? `<div class="sub-title">Thêm khi lên cấp</div><div class="icons">${c.extraUnits.slice(0, 6).map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}
      </div>
    </div>
    <div class="cards2">
      <div class="card"><div class="card-title">⚔️ Đồ cần</div>
        ${items.rows || '<span class="muted">Chưa có số liệu đồ.</span>'}
        ${!a.hasComps ? '<div class="sub-title">ⓘ Chọn mảnh đang có ở cột trái để biết món nào ghép ngay.</div>' : ''}
        ${a.hasComps && items.needList.length ? `<div class="sub-title">Mảnh nên nhặt</div><div class="icons">${items.needList.slice(0, 6).map(([id, n]) => iIcon(id, 'md') + (n > 1 ? `<b>×${n}</b>` : '')).join(' ')}</div>` : ''}
      </div>
      <div class="card"><div class="card-title">✨ Lõi hợp <span class="hint-inline" data-tip-text="Chưa có số liệu tỉ lệ thắng lõi Set 19. Danh sách chọn theo tộc hệ của đội.">ⓘ</span></div>
        <div class="sub-title">${augmentHint(c)}</div>
        <div>${augs.slice(0, 16).map(x => augChip(x, myAugs.has(x.id) ? 'mine' : '')).join('') || '<span class="muted">Không có lõi riêng cho tộc hệ của đội.</span>'}</div>
        ${state.augs.length ? `<div class="sub-title">Lõi bạn có</div><div>${state.augs.map(id => A.get(id) ? augChip(A.get(id), augs.some(y => y.id === id) ? 'mine' : '') : '').join('')}</div>` : ''}
      </div>
    </div>
    ${better.length && !a.empty ? `<div class="section-title">Đội đang hợp tình huống hơn</div>${better.map(r => suggCard(r, { analysis: targetAnalysis(r.c) })).join('')}` : ''}`;
}

// =====================================================================
// Nhắc việc: mở khoá tướng + lõi nhiệm vụ
// =====================================================================
const TRAIT_BY_NAME = new Map(D.traits.map(t => [t.nameEn.toLowerCase(), t.id]));
const UNIT_BY_NAME = (() => { const m = new Map(); D.units.forEach(u => { const k = u.nameEn.toLowerCase(); m.set(k, m.has(k) ? null : u.id); }); return m; })();
const copiesOf = id => state.mine.filter(x => x === id).length;
const starOf = n => n >= 9 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
const uniqMine = () => [...new Set(state.mine)];
const traitUnitCount = tid => uniqMine().filter(u => U.get(u)?.traits.includes(tid)).length;
const traitStarLevels = tids => uniqMine().filter(u => U.get(u)?.traits.some(t => tids.includes(t))).reduce((s, u) => s + starOf(copiesOf(u)), 0);
const traitIds = str => String(str).split(/\s+or\s+|,\s*/i).map(x => TRAIT_BY_NAME.get(x.trim().toLowerCase())).filter(Boolean);
function roundIndex(r) { const m = /^(\d)-(\d)$/.exec(r || ''); return m ? Number(m[1]) * 10 + Number(m[2]) : null; }

// Mở khoá: đọc điều kiện tiếng Anh, tự kiểm tra phần đọc được từ bàn của bạn.
function unlockCheck(u) {
  const txt = String(u.unlock || '').split(' / ')[0];
  const lvl = Number(state.level) || 0;
  const base = { title: `🔒 Mở khoá ${u.name}`, cond: u.unlock };
  if (u.unlockLevel && lvl < u.unlockLevel) return { ...base, level: 'grey', status: `Từ cấp ${u.unlockLevel} (đang cấp ${lvl})` };
  let m;
  if ((m = /^(\d)-star (.+?) with (\d+) items?/i.exec(txt))) {
    const id = UNIT_BY_NAME.get(m[2].toLowerCase()); const need = m[1] === '3' ? 9 : 3; const have = id ? copiesOf(id) : 0;
    if (!id) return { ...base, level: 'orange', status: 'Tự theo dõi trong game' };
    return have >= need ? { ...base, level: 'red', status: `Đủ ${esc(uname(id))} ${m[1]}★ → <b>nhớ cho ${esc(uname(id))} cầm ${m[3]} đồ!</b>` }
      : { ...base, level: 'orange', status: `${esc(uname(id))}: ${have}/${need} bản (cần ${m[1]}★ + ${m[3]} đồ)` };
  }
  if ((m = /^(\d)-star (.+?) or (.+?)\.?$/i.exec(txt))) {
    const ids = [m[2], m[3]].map(n => UNIT_BY_NAME.get(n.trim().toLowerCase())).filter(Boolean); const need = m[1] === '3' ? 9 : 3;
    const best = Math.max(0, ...ids.map(copiesOf));
    return best >= need ? { ...base, level: 'green', status: 'Đủ điều kiện ✔ (kiểm tra trong game đã mở chưa)' }
      : { ...base, level: 'orange', status: ids.map(i => `${esc(uname(i))} ${copiesOf(i)}/${need}`).join(' · ') };
  }
  if ((m = /^(\d+) unique star levels of (.+?)( Champions)?( without .*)?\.?$/i.exec(txt))) {
    const tids = traitIds(m[2]); const need = Number(m[1]); const have = traitStarLevels(tids);
    return have >= need ? { ...base, level: 'green', status: `Ước tính đủ ${have}/${need} cấp sao ✔` }
      : { ...base, level: 'orange', status: `Ước tính ${have}/${need} cấp sao (theo số bản bạn nhập)` };
  }
  if ((m = /^(\d+) unique (.+?) Champions/i.exec(txt))) {
    const tids = traitIds(m[2]); const need = Number(m[1]);
    const have = uniqMine().filter(x => U.get(x)?.traits.some(t => tids.includes(t))).length;
    return have >= need ? { ...base, level: 'green', status: `Đủ ${have}/${need} tướng ✔ (nhớ đặt lên bàn)` }
      : { ...base, level: 'orange', status: `Có ${have}/${need} tướng khác nhau` };
  }
  if ((m = /Have (\d+) or more non-unique traits active/i.exec(txt))) {
    const need = Number(m[1]); const have = activeTraits(state.mine).filter(x => x.on && x.t.type !== 'unique').length;
    return { ...base, level: have >= need ? 'red' : 'orange', status: have >= need ? `Đủ ${have}/${need} tộc hệ → <b>đặt đủ lên bàn khi giao tranh!</b>` : `Đang kích ${have}/${need} tộc hệ` };
  }
  if ((m = /before Stage (\d) Carousel/i.exec(txt))) {
    const cur = roundIndex(state.stage), deadline = Number(m[1]) * 10 + 4;
    if (cur && cur >= deadline) return { ...base, level: 'grey', status: 'Đã qua vòng chọn đồ chung, nếu chưa làm thì đã lỡ' };
    return { ...base, level: 'red', status: `<b>Làm ngay trước vòng ${m[1]}-4!</b>` };
  }
  if ((m = /while fielding (\w[\w' ]*)/i.exec(txt))) {
    const id = UNIT_BY_NAME.get(m[1].trim().toLowerCase());
    return { ...base, level: id && !copiesOf(id) ? 'red' : 'orange', status: id ? (copiesOf(id) ? `Đang có ${esc(uname(id))} ✔ · tự theo dõi tiến độ` : `<b>Cần đặt ${esc(uname(id))} lên bàn</b>`) : 'Tự theo dõi trong game' };
  }
  if ((m = /^Field (.+?) for (\d+) combats/i.exec(txt))) {
    const tid = TRAIT_BY_NAME.get(m[1].toLowerCase()); const on = tid && activeTraits(state.mine).find(x => x.id === tid && x.on);
    return { ...base, level: on ? 'orange' : 'red', status: on ? `Đang kích ${esc(T.get(tid).name)} ✔ · giữ ${m[2]} giao tranh` : `<b>Cần kích ${esc(tid ? T.get(tid).name : m[1])} trong ${m[2]} giao tranh</b>` };
  }
  return { ...base, level: 'orange', status: 'Tự theo dõi trong game' };
}

// Lõi: luật riêng cho lõi nhiệm vụ, còn lại nhắc theo mô tả.
const AUG_RULES = [
  { re: /IonicSparkPrismaticTour/, run: () => { const n = traitUnitCount('DA_IonicSpark19');
      return n < 7 ? { level: 'red', status: `<b>Đang có ${n}/7 Ionic Spark — chưa nhận chữ ký album!</b> Giữ 7 Ionic Spark kích hoạt suốt 10 vòng, rồi đặt đủ 10 Ionic Spark.` }
        : n < 10 ? { level: 'orange', status: `Đủ ${n}/7 Ionic Spark ✔ đang nhận chữ ký. Sau 10 vòng nhớ <b>đặt đủ 10 Ionic Spark</b>.` }
        : { level: 'green', status: `Đã có ${n} Ionic Spark ✔` }; } },
  { re: /HeartsteelPrismaticTour/, run: () => { const n = traitUnitCount('DA_Heartsteel19');
      return { level: n < 7 ? 'red' : 'orange', status: n < 7 ? `<b>Đang có ${n}/7 Heartsteel</b> — cần 7 Heartsteel kích hoạt để làm nhiệm vụ (gây / chặn sát thương, hồi máu).` : `Đủ ${n}/7 Heartsteel ✔ giữ nguyên để hoàn thành nhiệm vụ.` }; } },
  { re: /PentakillPrismaticTour/, run: () => { const n = traitUnitCount('DA_Pentakill19'), l = Number(state.level) || 0;
      return { level: n < 7 ? 'red' : 'orange', status: `${n < 7 ? `<b>Đang có ${n}/7 Pentakill</b>` : `Đủ ${n}/7 Pentakill ✔`} · cấp ${l}/10 · để tướng Pentakill hạ gục liên tiếp.` }; } },
  { re: /TrueDamagePrismaticTour/, run: () => { const n = traitUnitCount('DA_TrueDamage19');
      return { level: n < 5 ? 'red' : 'orange', status: `${n < 5 ? `<b>Đang có ${n}/5 True Damage</b>` : `Đủ ${n}/5 True Damage ✔`} · nhớ <b>giữ đúng chuỗi thắng / thua</b> theo yêu cầu nhiệm vụ.` }; } },
  { re: /KDAPrismaticTour/, run: () => { const n = traitStarLevels(['DA_KDA19']);
      return { level: n < 21 ? 'orange' : 'green', status: n < 21 ? `Ước tính <b>${n}/21 cấp sao K/DA</b> — nâng sao tướng K/DA (dùng Máy Sao Chép).` : `Ước tính đủ ${n}/21 cấp sao K/DA ✔` }; } },
  { re: /DeathByAThousandCuts/, run: () => { const n = traitUnitCount('DA_Swiftstriker19');
      return { level: n ? 'orange' : 'red', status: n ? `Có ${n} tướng Tốc Kích ✔ để chúng đánh đủ 250 rồi 1000 đòn.` : '<b>Chưa có tướng Tốc Kích trên bàn</b> — cần Tốc Kích đánh 250 / 1000 đòn mới nhận thưởng.' }; } },
  { re: /Manager_StakeholderMeeting/, run: () => { const n = traitUnitCount('DA_Manager19');
      return { level: n ? 'orange' : 'red', status: n ? 'Nhớ <b>đặt tướng Quản Lý vào ô Quản Lý</b>.' : '<b>Chưa có tướng Quản Lý</b> để đặt vào ô Quản Lý.' }; } },
  { re: /ComponentQuest/, run: () => ({ level: 'orange', status: 'Thắng giao tranh người chơi để nhận mảnh (7 lần) — ưu tiên giữ bàn mạnh.' }) },
  { re: /SalvageBin/, run: () => ({ level: 'orange', status: '<b>Bán tướng sẽ tách đồ hoàn chỉnh</b> — cẩn thận khi bán tướng đang cầm đồ.' }) },
  { re: /TimeSkip/, run: () => ({ level: 'orange', status: 'Cửa hàng bị khoá 3 vòng, sau đó nhận 32 XP — mua đủ tướng trước.' }) },
  { re: /GoldenEgg/, run: () => ({ level: 'orange', status: 'Thắng giao tranh người chơi để trứng nở nhanh hơn 1 vòng.' }) },
];
const TIMED_RE = /Sau \d+|sau \d+|Trong \d+|After \d+|after \d+|in \d+ rounds?|khi bắt đầu mỗi giai đoạn|start of each stage|lần tiếp theo/i;
function augReminder(a) {
  const rule = AUG_RULES.find(r => r.re.test(a.id));
  const at = state.augAt?.[a.id];
  const base = { title: `✨ ${a.name}`, cond: short(a.desc, 200), at };
  if (rule) return { ...base, ...rule.run() };
  if (TIMED_RE.test(a.desc)) return { ...base, level: 'grey', status: '⏱ Có thưởng theo thời gian' };
  return null;
}
function collectReminders() {
  const list = [];
  const target = state.target && D.comps.find(c => c.id === state.target);
  const hasInput = state.mine.length || compTotal(state.comps);
  const comp = target || (hasInput ? D.comps.map(c => scoreComp(c, LOBBY())).sort((a, b) => b.s - a.s)[0]?.c : null);
  // Tướng của đội cuối + tướng trong bàn chính của lộ trình theo cấp (vd Seraphine phải mở từ đầu trận).
  const pathUnits = comp ? Object.values(comp.path || {}).flatMap(l => l.boards[0]?.units || []) : [];
  if (comp) [...new Set([...comp.units, ...pathUnits])].forEach(id => {
    const u = U.get(id);
    if (!u?.unlock || state.unlocked.includes(id) || copiesOf(id)) return; // đã có tướng trên bàn tức là đã mở
    list.push({ key: 'unlock:' + id, unit: id, kind: 'unlock', ...unlockCheck(u) });
  });
  state.augs.forEach(aid => {
    const a = A.get(aid); if (!a) return;
    const r = augReminder(a); if (r) list.push({ key: 'aug:' + aid, kind: 'aug', aug: aid, ...r });
  });
  const ORDER = { red: 0, orange: 1, grey: 2, green: 3 };
  return { comp, target, items: list.filter(r => !state.done.includes(r.key)).sort((x, y) => ORDER[x.level] - ORDER[y.level]) };
}
function remindersHtml() {
  const { comp, target, items } = collectReminders();
  if (!items.length) return '';
  const urgent = items.filter(r => r.level === 'red').length;
  const LBL = { red: 'Làm ngay', orange: 'Đang làm', grey: 'Chưa tới', green: 'Đã đủ' };
  return `<div class="card remind ${urgent ? 'hot' : ''}" id="remind">
    <div class="card-title">🔔 Nhắc việc <span class="rcount ${urgent ? 'hot' : ''}">${urgent ? urgent + ' việc cần làm ngay' : items.length + ' việc'}</span>
      ${comp && !target ? `<span class="hint-inline">mở khoá theo đội gợi ý: ${esc(comp.name)}</span>` : ''}</div>
    ${items.map(r => `<div class="ritem ${r.level}">
      <span class="rtag">${LBL[r.level]}</span>
      ${r.unit ? uIcon(r.unit, { size: 'sm' }) : r.aug ? `<img class="raug" src="${esc(A.get(r.aug)?.icon || '')}" alt="" onerror="this.remove()">` : ''}
      <div class="rbody"><div><b>${esc(r.title)}</b>${r.at ? ` <span class="muted">· lấy ở vòng ${esc(r.at)}</span>` : ''}</div>
        <div class="rstatus">${r.status}</div>
        <div class="rcond" ${r.kind === 'aug' ? `data-aug="${esc(r.aug)}"` : ''}>${esc(r.cond)}</div></div>
      <button class="btn ghost" ${r.kind === 'unlock' ? `data-unlocked="${esc(r.unit)}"` : `data-done="${esc(r.key)}"`}>${r.kind === 'unlock' ? '✓ Đã mở khoá' : '✓ Đã xong'}</button>
    </div>`).join('')}
  </div>`;
}

function renderOutput() {
  const out = $('#board-output');
  const target = state.target && D.comps.find(c => c.id === state.target);
  const rem = remindersHtml();
  if (target) { out.innerHTML = rem + renderTargetView(target); return; }
  const empty = !state.mine.length && !compTotal(state.comps);
  if (empty) {
    const top = D.comps.filter(c => c.tier !== '?').slice(0, 4).map(c => ({ c, why: [] }));
    out.innerHTML = rem + `<div class="card welcome"><h2>Chào bạn 👋</h2>
        <div class="muted">Nhập tình huống ở cột trái, tool sẽ gợi ý đội hợp nhất, việc cần làm, đồ và lõi.</div>
        <div class="steps3"><div><b>1. Tướng</b>Bấm trái: của bạn · bấm phải: nhà khác đang tranh. Gõ tên + Enter cho nhanh.</div>
        <div><b>2. Mảnh đồ</b>Bấm trái thêm, bấm phải bớt.</div><div><b>3. Nhắm đội</b>Bấm 🎯 Nhắm để xem kế hoạch chi tiết và copy mã đội.</div></div></div>
      <div class="card"><div class="card-title">📋 Bước tiếp theo</div>${linesHtml(tempoLines(null))}</div>
      <div class="section-title">Đội mạnh nhất hiện tại</div>${top.map(r => suggCard(r)).join('')}`;
    return;
  }
  const ranked = D.comps.map(c => scoreComp(c, LOBBY())).sort((a, b) => b.s - a.s).slice(0, 5);
  const now = compTotal(state.comps) ? craftableNow(state.comps) : [];
  out.innerHTML = rem + `<div class="cards2">
      <div class="card"><div class="card-title">📋 Bước tiếp theo</div>${linesHtml(tempoLines(null))}</div>
      <div class="card"><div class="card-title">🔷 Tộc hệ đang có</div>${traitChipsFor(state.mine) || '<span class="muted">Chưa chọn tướng.</span>'}</div>
    </div>
    <div class="section-title">Đội hợp nhất lúc này</div>
    ${ranked.map(r => suggCard(r, { analysis: targetAnalysis(r.c) })).join('')}
    ${now.length ? `<div class="card"><div class="card-title">🧩 Ghép được ngay</div>${now.map(recipeHtml).join('')}</div>` : ''}`;
}
function renderBoardState() { renderSteppers(); renderTrays(); renderComponents(); renderAugChosen(); markPool(); renderOutput(); }
function renderBoard() { renderPool(); renderBoardState(); }

function addMine(id) { state.mine.push(id); save(); renderTrays(); markPool(); renderOutput(); }
function addContested(id) {
  const o = state.opponents[state.activeOpp];
  if (!o.units.includes(id)) o.units.push(id);
  syncContested(); save(); renderTrays(); markPool(); renderOutput();
}
function setTarget(id) {
  state.target = id; ui.pathLevel = null; save();
  if (!$('#tab-board').classList.contains('active')) showTab('board'); else renderOutput();
  closeDrawer();
  const out = $('#board-output'); out.scrollTop = 0;
  const hero = $('#target-hero'); if (hero) { hero.classList.remove('flash'); void hero.offsetWidth; hero.classList.add('flash'); }
}

function bindBoard() {
  const search = $('#board-unit-search');
  search.addEventListener('input', renderPool);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = poolMatches()[0]; if (!first) return;
      e.shiftKey ? addContested(first.id) : addMine(first.id);
      toast(`${e.shiftKey ? '⚔ ' + esc(state.opponents[state.activeOpp].name) : '✅ Đã thêm'}: <b>${esc(first.name)}</b>`, 1500);
      search.select();
    } else if (e.key === 'Escape') { search.value = ''; renderPool(); search.blur(); }
  });
  $('#cost-filter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { ui.poolCost = Number(c.dataset.v); renderPool(); } });
  const pool = $('#board-unit-pool');
  pool.addEventListener('click', e => { const t = e.target.closest('[data-pick]'); if (t) addMine(t.dataset.pick); });
  pool.addEventListener('contextmenu', e => { const t = e.target.closest('[data-pick]'); if (t) { e.preventDefault(); addContested(t.dataset.pick); } });
  $('#mine-list').addEventListener('click', e => {
    const t = e.target.closest('[data-rm-mine]'); if (!t) return;
    const i = state.mine.lastIndexOf(t.dataset.rmMine); if (i >= 0) state.mine.splice(i, 1);
    save(); renderTrays(); markPool(); renderOutput(); hideTip();
  });
  const opp = $('#opp-list');
  opp.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-opp]');
    if (rm) {
      const [i, id] = rm.dataset.rmOpp.split('|');
      state.opponents[+i].units = state.opponents[+i].units.filter(x => x !== id);
      syncContested(); save(); renderTrays(); markPool(); renderOutput(); hideTip(); return;
    }
    if (e.target.closest('[data-comp-detail]')) return;
    const row = e.target.closest('[data-opp]');
    if (row) { state.activeOpp = +row.dataset.opp; save(); renderOpps(); }
  });
  opp.addEventListener('dblclick', e => {
    const n = e.target.closest('[data-opp-name]'); if (!n) return;
    const i = +n.dataset.oppName;
    const name = prompt('Tên nhà ' + (i + 1) + ':', state.opponents[i].name);
    if (name && name.trim()) { state.opponents[i].name = name.trim().slice(0, 24); save(); renderOpps(); renderOutput(); }
  });
  $('#new-game').addEventListener('click', () => {
    if (!confirm('Bắt đầu ván mới? Sẽ xoá tướng, mảnh đồ, lõi, đội đang nhắm và các dấu đã xong / đã mở khoá.')) return;
    Object.assign(state, { mine: [], contested: [], opponents: newOpponents(), activeOpp: 0, comps: {}, augs: [], augAt: {}, unlocked: [], done: [], stage: '1-2', level: 1, gold: 0, hp: 100, target: null });
    ui.pathLevel = null; save(); renderBoard(); toast('🆕 Đã bắt đầu ván mới', 2000);
  });
  $('#clear-units').addEventListener('click', () => { state.mine = []; state.opponents.forEach(o => { o.units = []; }); syncContested(); save(); renderBoardState(); });
  $('#copy-mine').addEventListener('click', () => copyTeam(state.mine, 'bàn của bạn'));
  $('#clear-comps').addEventListener('click', () => { state.comps = {}; save(); renderComponents(); renderOutput(); });
  const comp = $('#component-picker');
  comp.addEventListener('click', e => {
    const el = e.target.closest('[data-comp]'); if (!el) return;
    state.comps[el.dataset.comp] = (state.comps[el.dataset.comp] || 0) + 1; save(); renderComponents(); renderOutput();
  });
  comp.addEventListener('contextmenu', e => {
    const el = e.target.closest('[data-comp]'); if (!el) return; e.preventDefault();
    const id = el.dataset.comp; state.comps[id] = Math.max(0, (state.comps[id] || 0) - 1); save(); renderComponents(); renderOutput();
  });
  // Steppers
  const st = $('#steppers');
  st.addEventListener('click', e => {
    const b = e.target.closest('button[data-dir]'); if (!b) return;
    const k = b.closest('[data-step]').dataset.step;
    stepValue(k, Number(b.dataset.dir), e.shiftKey ? 5 : 1);
    if (k === 'level') ui.pathLevel = null;
    save(); renderSteppers(); renderOutput();
  });
  st.addEventListener('change', e => {
    const box = e.target.closest('[data-step]'); if (!box || e.target.tagName !== 'INPUT') return;
    const k = box.dataset.step, v = e.target.value.trim();
    if (k === 'stage') state.stage = /^\d-\d$/.test(v) ? v : ''; else state[k] = Number(v) || 0;
    if (k === 'level') ui.pathLevel = null;
    save(); renderSteppers(); renderOutput();
  });
  st.addEventListener('wheel', e => {
    const box = e.target.closest('[data-step]'); if (!box) return;
    e.preventDefault(); stepValue(box.dataset.step, e.deltaY < 0 ? 1 : -1, 1); if (box.dataset.step === 'level') ui.pathLevel = null; save(); renderSteppers(); renderOutput();
  }, { passive: false });
  // Lõi
  const as = $('#aug-search'), sug = $('#aug-suggest');
  as.addEventListener('input', () => {
    const q = norm(as.value);
    const list = q.length < 2 ? [] : D.augments.filter(a => norm(a.name).includes(q) || norm(a.nameEn).includes(q)).slice(0, 12);
    sug.innerHTML = list.map((a, i) => `<div data-add-aug="${esc(a.id)}" class="${i === 0 ? 'sel' : ''}"><span>${esc(a.name)}</span><span class="muted">${RARITY_VI[a.rarity] || ''}</span></div>`).join('');
    sug.classList.toggle('show', list.length > 0);
  });
  const addAug = id => { if (!state.augs.includes(id)) { state.augs.push(id); state.augAt[id] = state.stage || null; } as.value = ''; sug.classList.remove('show'); save(); renderAugChosen(); renderOutput(); };
  as.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = sug.querySelector('[data-add-aug]'); if (f) addAug(f.dataset.addAug); } if (e.key === 'Escape') { as.value = ''; sug.classList.remove('show'); } });
  as.addEventListener('blur', () => setTimeout(() => sug.classList.remove('show'), 150));
  sug.addEventListener('mousedown', e => { const el = e.target.closest('[data-add-aug]'); if (el) { e.preventDefault(); addAug(el.dataset.addAug); } });
  $('#aug-chosen').addEventListener('click', e => {
    const el = e.target.closest('[data-rm-aug]'); if (!el) return;
    const [rm] = state.augs.splice(Number(el.dataset.rmAug), 1); if (rm) { delete state.augAt[rm]; state.done = state.done.filter(k => k !== 'aug:' + rm); }
    save(); renderAugChosen(); renderOutput(); hideTip();
  });
}

// =====================================================================
// Tab Đội hình mạnh
// =====================================================================
function compCard(c) {
  return `<div class="card comp-card">
    <div class="head"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><span class="name">${esc(c.name)}</span>
      <span class="pill">${esc(c.levellingVi)}</span><span class="spacer"></span>
      <button class="icon-btn target" data-set-target="${esc(c.id)}">🎯 Nhắm</button>${copyBtn('comp:' + c.id)}
      <button class="icon-btn" data-comp-detail="${esc(c.id)}" data-tip-text="Xem chi tiết">ⓘ</button></div>
    <div class="icons" style="margin-top:6px"><span class="pill">hạng TB <b>${fmt(c.avg)}</b></span><span class="pill">${(c.count || 0).toLocaleString('vi-VN')} trận</span><span class="pill">tỉ lệ chơi <b>${pct(c.share)}</b></span></div>
    ${compUnitsRow(c)}
    <div>${traitChipsFor(c.units, true)}</div>
  </div>`;
}
function renderComps() {
  $('#comp-level').innerHTML = chipsHtml([['', 'Mọi lối chơi'], ...LEVELS.map(l => [l, esc(l)])], ui.compLevel);
  const q = norm($('#comp-search').value);
  const list = D.comps.filter(c => (!ui.compLevel || c.levellingVi === ui.compLevel) && (!q || norm(c.name).includes(q) ||
    c.units.some(u => norm(U.get(u)?.name).includes(q) || norm(U.get(u)?.nameEn).includes(q)) ||
    c.traits.some(t => norm(T.get(t.id)?.name).includes(q) || norm(T.get(t.id)?.nameEn).includes(q))));
  $('#comps-note').innerHTML = `ⓘ Số liệu ${esc(D.meta.compsQueue)} (${esc(D.meta.compsSet)}), ${(D.meta.compsGames || 0).toLocaleString('vi-VN')} lượt chơi. Bậc S–D theo hạng trung bình (thấp = tốt). Ở PBE số liệu còn dao động.`;
  $('#comp-list').innerHTML = list.map(compCard).join('') || '<p class="muted">Không có đội nào khớp.</p>';
}
function compDetail(id) {
  const c = D.comps.find(x => x.id === id); if (!c) return;
  openDrawer(`<div class="hero-h"><span class="tier ${esc(c.tier)}">${esc(c.tier)}</span><h2>${esc(c.name)}</h2></div>
    <div class="icons" style="margin:8px 0"><span class="pill">${esc(c.levellingVi)}</span><span class="pill">hạng TB <b>${fmt(c.avg)}</b></span><span class="pill">${(c.count || 0).toLocaleString('vi-VN')} trận</span><span class="pill">tỉ lệ chơi ${pct(c.share)}</span></div>
    <div class="icons"><button class="btn primary big" data-set-target="${esc(c.id)}">🎯 Nhắm đội này</button><button class="btn big" data-copy="comp:${esc(c.id)}">📋 Copy mã</button></div>
    <h3>Đội hình</h3>${compUnitsRow(c)}<div style="margin-top:6px">${traitChipsFor(c.units, true)}</div>
    ${pathLevels(c).length ? `<h3>🪜 Lộ trình theo cấp</h3>${pathLevels(c).map(L => {
      const lv = c.path[L];
      return `<div class="plevel"><div class="sub-title">Cấp ${L}${lv.stage ? ` · thường ở vòng <b>${esc(lv.stage)}</b>` : ''}</div>
        ${lv.boards.map((b, i) => pathBoardHtml(b, new Set(), { alt: i > 0, label: i ? 'Thay thế ' + i : 'Bàn chính' })).join('')}</div>`;
    }).join('')}` : ''}
    ${c.positions ? `<h3>📍 Xếp vị trí</h3>${hexBoardHtml(c, c.units, null)}` : ''}
    ${(c.counters || []).length ? (() => {
      const cs = c.counters.filter(x => COMP_BY_ID.has(x.id));
      const row = x => `<div class="build-row"><span class="tier sm ${esc(COMP_BY_ID.get(x.id).tier)}">${esc(COMP_BY_ID.get(x.id).tier)}</span><a href="#" data-comp-detail="${esc(x.id)}">${esc(COMP_BY_ID.get(x.id).name)}</a><span class="pill ${x.d > 0.1 ? 'bad' : x.d < -0.1 ? 'good' : ''}">${signed(x.d)} hạng</span>${x.s >= 0.3 ? `<span class="muted" style="font-size:12px">giống ${Math.round(x.s * 100)}%</span>` : ''}</div>`;
      const diff = cs.filter(x => x.s < 0.3);
      const strong = [...diff].sort((a, b) => a.d - b.d).slice(0, 3).filter(x => x.d < 0);
      const weak = [...diff].sort((a, b) => b.d - a.d).slice(0, 3).filter(x => x.d > 0);
      const similar = cs.filter(x => x.s >= 0.3).sort((a, b) => b.s - a.s).slice(0, 4);
      return `<h3>⚔ Khắc chế</h3><div class="hint-inline">Hạng của đội này thay đổi bao nhiêu khi trong sảnh có đội kia (âm = tốt hơn).</div>
        ${strong.length ? `<div class="sub-title good">Mạnh khi gặp</div>${strong.map(row).join('')}` : ''}
        ${weak.length ? `<div class="sub-title bad">Yếu khi gặp</div>${weak.map(row).join('')}` : ''}
        ${similar.length || c.selfMirror != null ? `<div class="sub-title">Hay bị tranh tướng với</div>${c.selfMirror != null ? `<div class="build-row"><span>Chính đội này (2 nhà cùng chơi)</span><span class="pill bad">${signed(c.selfMirror)} hạng</span></div>` : ''}${similar.map(row).join('')}` : ''}`;
    })() : ''}
    <h3>Lên đồ chủ lực</h3>${c.builds.map(b => `<div class="build-row"><span class="who">${uIcon(b.unit, { size: 'sm' })}${esc(uname(b.unit))}</span>${b.items.map(x => iIcon(x, 'md')).join('')}<span class="muted" style="font-size:12px">hạng TB ${fmt(b.avg)} · ${b.count} trận</span></div>`).join('')}
    <h3>Đồ hay dùng trong đội</h3><div class="icons">${c.topItems.map(x => iIcon(x, 'md')).join('')}</div>
    ${c.extraUnits.length ? `<h3>Thêm khi lên cấp</h3><div class="icons">${c.extraUnits.map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}`);
}

// =====================================================================
// Tab Tướng
// =====================================================================
function renderUnits() {
  $('#unit-cost').innerHTML = chipsHtml([[0, 'Mọi giá'], ...COSTS.map(c => [c, c + ' 💰'])], ui.unitCost, v => v ? 'cost' + v : '');
  $('#unit-trait').innerHTML = chipsHtml([['', 'Mọi tộc hệ'], ...D.traits.filter(t => t.type !== 'unique').sort((a, b) => a.name.localeCompare(b.name)).map(t => [t.id, esc(t.name)])], ui.unitTrait);
  const q = norm($('#unit-search').value);
  const list = D.units.filter(u => (!ui.unitCost || u.cost === ui.unitCost) && (!ui.unitTrait || u.traits.includes(ui.unitTrait)) &&
    (!q || norm(u.name).includes(q) || norm(u.nameEn).includes(q))).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  $('#unit-list').innerHTML = `<div class="unit-grid">${list.map(u => {
    const ui2 = D.unitItems[u.id];
    return `<div class="card unit-card" data-unit="${esc(u.id)}">${uIcon(u.id, { size: 'lg', attr: '' })}
      <span class="nm">${esc(u.name)}</span><span class="sub">${u.cost} 💰 · ${esc(u.role)}</span>
      <span>${unitTraits(u).filter(t => t.type !== 'unique').map(t => `<span class="sub">${esc(t.name)}</span>`).join(' · ')}</span>
      ${ui2 ? `<span class="icons">${ui2.items.slice(0, 3).map(x => iIcon(x.id)).join('')}</span>` : ''}</div>`;
  }).join('')}</div>`;
}
function unitDetail(id) {
  const u = U.get(id); if (!u) return;
  const s = u.stats, ui2 = D.unitItems[id];
  const inComps = D.comps.filter(c => c.units.includes(id)).slice(0, 6);
  const plan = compTotal(state.comps) ? solveItems(state.comps, unitTargets(id)).pick : [];
  openDrawer(`<div class="row">${uIcon(id, { size: 'xl', attr: '' })}<div><h2>${esc(u.name)}</h2>
      <div class="icons" style="margin:4px 0"><span class="pill">${u.cost} 💰</span><span class="pill">${esc(u.role)}</span>${u.pool ? `<span class="pill">${u.pool} con trong bể</span>` : ''}</div>
      <div>${u.traits.map(t => tChip(t)).join('')}</div></div></div>
    ${u.unlock ? `<h3>🔒 Mở khoá${u.unlockLevel ? ' · từ cấp ' + u.unlockLevel : ''}</h3><div class="desc">${esc(u.unlock)}</div>` : ''}
    <h3>Kỹ năng: ${esc(u.ability.name)}</h3><div class="desc">${esc(u.ability.desc)}</div>
    <div class="hint-inline" style="margin-top:4px">a/b/c = 1★/2★/3★ · (SMPT)/(SMCK) = tăng theo sức mạnh phép / công</div>
    <h3>Chỉ số</h3><table class="stats"><tr><td>Máu</td><td>${s.hp ?? '–'}</td><td>Giáp</td><td>${s.armor ?? '–'}</td><td>Kháng phép</td><td>${s.mr ?? '–'}</td></tr>
      <tr><td>Công</td><td>${s.ad ?? '–'}</td><td>Tốc đánh</td><td>${s.as ?? '–'}</td><td>Tầm</td><td>${s.range ?? '–'}</td></tr>
      <tr><td>Năng lượng</td><td>${s.startMana ?? 0}/${s.mana ?? '–'}</td><td></td><td></td><td></td><td></td></tr></table>
    <h3>Đồ hay lên</h3>${ui2 ? `<div>${ui2.items.slice(0, 8).map(x => `<span class="recipe">${iIcon(x.id, 'md')} ${esc(I.get(x.id)?.name || x.id)} <span class="muted">TB ${fmt(x.avg)}</span></span>`).join('')}</div>
      <h3>Bộ 3 món tốt</h3>${ui2.builds.map(b => `<div class="build-row">${b.items.map(x => iIcon(x, 'md')).join('')}<span class="muted" style="font-size:12px">hạng TB ${fmt(b.avg)} · ${b.count} trận</span></div>`).join('')}` : '<div class="muted">Chưa có số liệu đồ.</div>'}
    <h3>Lên đồ từ mảnh đang có</h3>${!compTotal(state.comps) ? '<div class="muted">Chưa chọn mảnh ở tab Tình huống.</div>' : plan.length ? plan.map(p => recipeHtml(I.get(p.item))).join('') : '<div class="muted">Mảnh hiện có chưa ghép được món hợp tướng này.</div>'}
    ${inComps.length ? `<h3>Có trong đội hình</h3>${inComps.map(c => `<div class="build-row"><span class="tier sm ${esc(c.tier)}">${esc(c.tier)}</span><a href="#" data-comp-detail="${esc(c.id)}">${esc(c.name)}</a><span class="muted" style="font-size:12px">hạng TB ${fmt(c.avg)}</span><span style="flex:1"></span><button class="icon-btn target" data-set-target="${esc(c.id)}">🎯 Nhắm</button></div>`).join('')}` : ''}`);
}

// =====================================================================
// Tab Tộc hệ
// =====================================================================
function traitCard(t) {
  return `<div class="card"><div class="hero-h"><img src="${esc(t.icon)}" style="width:28px;height:28px" alt="" onerror="this.remove()"><b style="font-size:15px">${esc(t.name)}</b><span class="pill">${TYPE_VI[t.type] || ''}</span><span class="muted" style="font-size:12px">${esc(t.nameEn)}</span></div>
    <div class="desc" style="margin-top:6px">${esc(t.desc)}</div>
    ${t.steps.filter(s => s.desc).map(s => `<div class="desc">• ${esc(s.desc)}</div>`).join('')}
    <div class="icons" style="margin-top:8px">${t.units.map(u => uIcon(u, { size: 'sm' })).join('')}</div></div>`;
}
function renderTraits() {
  $('#trait-type').innerHTML = chipsHtml([['', 'Tất cả'], ['origin', 'Tộc'], ['class', 'Hệ'], ['unique', 'Riêng của tướng']], ui.traitType);
  const q = norm($('#trait-search').value);
  const list = D.traits.filter(t => (ui.traitType ? t.type === ui.traitType : t.type !== 'unique') && (!q || norm(t.name).includes(q) || norm(t.nameEn).includes(q)))
    .sort((a, b) => (a.type > b.type ? -1 : a.type < b.type ? 1 : 0) || a.name.localeCompare(b.name));
  $('#trait-list').innerHTML = list.map(traitCard).join('') || '<p class="muted">Không có tộc hệ nào khớp.</p>';
}

// =====================================================================
// Tab Trang bị
// =====================================================================
function usersOf(itemId) {
  return Object.entries(D.unitItems).map(([u, x]) => ({ u, c: x.items.find(i => i.id === itemId)?.count || 0 }))
    .filter(x => x.c).sort((a, b) => b.c - a.c).slice(0, 8).map(x => x.u);
}
function renderMatrix() {
  const have = state.comps;
  let h = '<table class="matrix"><tr><th></th>' + COMPONENTS.map(c => `<th>${iIcon(c.id)}</th>`).join('') + '</tr>';
  COMPONENTS.forEach(a => {
    h += `<tr><th>${iIcon(a.id)}</th>` + COMPONENTS.map(b => {
      const it = RECIPE.get([a.id, b.id].sort().join('|'));
      const can = a.id === b.id ? (have[a.id] || 0) >= 2 : (have[a.id] || 0) && (have[b.id] || 0);
      return `<td class="${can ? 'hl' : ''}">${it ? iIcon(it.id) : ''}</td>`;
    }).join('') + '</tr>';
  });
  $('#item-matrix').innerHTML = h + '</table><p class="note">ⓘ Ô viền vàng = ghép được bằng mảnh đang chọn ở tab Tình huống. Rê chuột để xem tên món.</p>';
}
function renderItems() {
  const kinds = ['craftable', 'emblem', 'artifact', 'radiant', 'support', 'component', 'other'].filter(k => D.items.some(i => i.kind === k));
  $('#item-kind').innerHTML = chipsHtml(kinds.map(k => [k, KIND_VI[k]]), ui.itemKind);
  const q = norm($('#item-search').value);
  $('#item-matrix').style.display = ui.itemKind === 'craftable' && !q ? '' : 'none';
  if (ui.itemKind === 'craftable') renderMatrix();
  const list = D.items.filter(i => i.kind === ui.itemKind && (!q || norm(i.name).includes(q) || norm(i.nameEn).includes(q)));
  $('#item-list').innerHTML = list.map(i => {
    const users = usersOf(i.id);
    return `<div class="card"><div class="row">${iIcon(i.id, 'lg')}<div><b style="font-size:15px">${esc(i.name)}</b> <span class="muted" style="font-size:12px">${esc(i.nameEn)}</span>
      ${i.from.length === 2 ? `<div class="icons">${iIcon(i.from[0])}+${iIcon(i.from[1])}</div>` : ''}
      ${i.stats ? `<div class="muted" style="font-size:12px">${esc(i.stats)}</div>` : ''}</div></div>
      <div class="desc" style="margin-top:6px">${esc(i.desc)}</div>
      ${users.length ? `<div class="sub-title">Hay dùng cho</div><div class="icons">${users.map(u => uIcon(u, { size: 'sm' })).join('')}</div>` : ''}</div>`;
  }).join('') || '<p class="muted">Không có trang bị nào khớp.</p>';
}
function itemDetail(id) {
  const i = I.get(id); if (!i) return;
  const users = usersOf(id);
  openDrawer(`<div class="row">${iIcon(id, 'lg')}<div><h2>${esc(i.name)}</h2><span class="muted">${esc(i.nameEn)} · ${KIND_VI[i.kind] || ''}</span></div></div>
    ${i.from.length === 2 ? `<h3>Công thức</h3><div class="icons">${iIcon(i.from[0], 'md')} ${esc(I.get(i.from[0])?.name)} + ${iIcon(i.from[1], 'md')} ${esc(I.get(i.from[1])?.name)}</div>` : ''}
    ${i.stats ? `<h3>Chỉ số</h3><div>${esc(i.stats)}</div>` : ''}<h3>Hiệu ứng</h3><div class="desc">${esc(i.desc)}</div>
    ${users.length ? `<h3>Hay dùng cho</h3><div class="icons">${users.map(u => uIcon(u)).join('')}</div>` : ''}
    ${i.kind === 'component' ? `<h3>Ghép với mảnh khác</h3>${COMPONENTS.map(c => RECIPE.get([id, c.id].sort().join('|'))).filter(Boolean).map(recipeHtml).join('')}` : ''}`);
}

// =====================================================================
// Tab Lõi
// =====================================================================
function renderAugments() {
  $('#augment-rarity').innerHTML = chipsHtml([['', 'Mọi bậc'], ['Silver', 'Bạc'], ['Gold', 'Vàng'], ['Prismatic', 'Kim Cương']], ui.augRarity);
  const tags = [...new Set(D.augments.flatMap(a => a.tags))].sort();
  $('#augment-tag').innerHTML = chipsHtml([['', 'Mọi loại'], ...tags.map(t => [t, TAG_VI[t] || esc(t)])], ui.augTag);
  const q = norm($('#augment-search').value);
  const list = D.augments.filter(a => (!ui.augRarity || a.rarity === ui.augRarity) && (!ui.augTag || a.tags.includes(ui.augTag)) &&
    (!q || norm(a.name).includes(q) || norm(a.nameEn).includes(q) || norm(a.desc).includes(q)));
  $('#augment-list').innerHTML = list.map(a => `<div class="card aug-card">
    <div class="row"><img src="${esc(a.icon)}" alt="" onerror="this.remove()" loading="lazy">
    <div><b style="font-size:15px">${esc(a.name)}</b> <span class="aug ${esc(a.rarity)}" style="padding:1px 8px">${RARITY_VI[a.rarity] || esc(a.rarity)}</span>
    <div class="muted" style="font-size:12px">${esc(a.nameEn)}${a.rounds.length ? ' · vòng ' + a.rounds.map(esc).join(', ') : ''}${a.tags.length ? ' · ' + a.tags.map(t => TAG_VI[t] || esc(t)).join(', ') : ''}</div>
    ${a.traits.length ? `<div>${a.traits.map(t => tChip(t)).join('')}</div>` : ''}</div></div>
    <div class="desc" style="margin-top:6px">${esc(a.desc)}</div></div>`).join('') || '<p class="muted">Không có lõi nào khớp.</p>';
}

// =====================================================================
// Tab Mẹo
// =====================================================================
function renderTips() {
  const card = (t, body) => `<div class="card"><div class="card-title">${t}</div><div class="desc">${body}</div></div>`;
  $('#tips').innerHTML = [
    card('⬆️ Mốc lên cấp', '2-1 → cấp 4\n2-5 → cấp 5\n3-2 → cấp 6\n3-5 / 4-1 → cấp 7\n4-2 → cấp 8, roll tìm 4 vàng\n5-1+ → cấp 9 nếu cần tướng 5 vàng'),
    card('💰 Lãi và vàng', 'Mỗi 10 vàng = +1 lãi, tối đa +5 ở 50 vàng.\nGiữ chuỗi thắng / thua để có thêm vàng.\nReroll: giữ cấp, roll phần trên 50 tới khi chủ lực 3★.\nLên nhanh: giữ 50, lên cấp đúng mốc, roll mạnh ở 8 / 9.'),
    card('⚔️ Ghép đồ', 'Ghép sớm đồ mạnh để giữ máu, đừng ôm mảnh quá lâu.\nXẻng / Chảo ghép ra Ấn để kích thêm tộc hệ.\nXem đồ chủ lực ở khung Đội đang nhắm.'),
    card('🎵 Set 19 – Prismatic Tour', `${D.units.filter(u => u.unlock).length} tướng phải mở khoá (🔒) mới ra trong cửa hàng.\nTướng 7 vàng: ${D.units.filter(u => u.cost === 7).map(u => esc(u.name)).join(', ')}.`),
    card('⌨️ Phím tắt', '/ → nhảy vào ô tìm tướng\nEnter → thêm tướng đầu tiên vào Bàn của tôi\nShift+Enter → thêm vào Nhà khác tranh\nEsc → xoá ô tìm / đóng ngăn chi tiết\nShift+bấm − / + → đổi 5 đơn vị'),
    card('🤖 Hỏi Claude khi đang chơi', 'Win+Shift+S chụp màn hình game → dán vào chat Claude ở dự án này.\nVí dụ: "roll hay lên cấp?", "chọn lõi nào?", "nhà nào tranh tướng?".\nChụp thêm bàn nhà khác để Claude kiểm tra.'),
    card('🔄 Cập nhật dữ liệu', `Chạy: node scripts/update-data.mjs\nĐang dùng: ${esc(D.meta.setName)} (${esc(D.meta.patch)}), cập nhật ${esc(new Date(D.meta.fetchedAt).toLocaleString('vi-VN'))}.`),
  ].join('');
}

// =====================================================================
// Ngăn chi tiết, ô thông tin, điều hướng
// =====================================================================
function openDrawer(html) { $('#drawer-body').innerHTML = html; const d = $('#drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); d.scrollTop = 0; hideTip(); }
function closeDrawer() { const d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); }
function traitDetail(id) { const t = T.get(id); if (t) openDrawer(traitCard(t)); }

const tipEl = () => $('#tip');
function tipHtml(el) {
  const uid = el.dataset.unit || el.dataset.tipunit || el.dataset.pick;
  if (uid && U.get(uid)) {
    const u = U.get(uid), ui2 = D.unitItems[uid];
    return `<div class="t-h">${esc(u.name)}</div><div class="t-s">${u.cost} 💰 · ${esc(u.role)}</div>
      <div>${unitTraits(u).map(t => esc(t.name)).join(' · ')}</div>
      ${u.unlock ? `<div class="warn" style="margin-top:4px">🔒 ${esc(short(u.unlock, 120))}</div>` : ''}
      ${ui2 ? `<div style="margin-top:4px">${ui2.items.slice(0, 3).map(x => `<img class="it" src="${esc(I.get(x.id)?.icon || '')}" alt="">`).join(' ')}</div>` : ''}`;
  }
  const iid = el.dataset.item || el.dataset.tipitem;
  if (iid && I.get(iid)) {
    const i = I.get(iid);
    return `<div class="t-h">${esc(i.name)}</div><div class="t-s">${KIND_VI[i.kind] || ''}${i.stats ? ' · ' + esc(i.stats) : ''}</div>
      ${i.from.length === 2 ? `<div><img class="it" src="${esc(I.get(i.from[0])?.icon)}" alt=""> + <img class="it" src="${esc(I.get(i.from[1])?.icon)}" alt=""></div>` : ''}
      <div class="desc">${esc(short(i.desc, 240))}</div>`;
  }
  if (el.dataset.trait && T.get(el.dataset.trait)) {
    const t = T.get(el.dataset.trait);
    return `<div class="t-h">${esc(t.name)}</div><div class="t-s">${TYPE_VI[t.type] || ''} · ${t.units.length} tướng</div>
      ${t.steps.filter(s => s.desc).slice(0, 5).map(s => `<div class="desc">• ${esc(short(s.desc, 90))}</div>`).join('') || `<div class="desc">${esc(short(t.desc, 200))}</div>`}`;
  }
  if (el.dataset.aug && A.get(el.dataset.aug)) {
    const a = A.get(el.dataset.aug);
    return `<div class="t-h">${esc(a.name)}</div><div class="t-s">${RARITY_VI[a.rarity] || ''}${a.tags.length ? ' · ' + a.tags.map(t => TAG_VI[t] || t).join(', ') : ''}</div><div class="desc">${esc(short(a.desc, 260))}</div>`;
  }
  if (el.dataset.tipText) return esc(el.dataset.tipText);
  return '';
}
let tipTarget = null;
function hideTip() { tipTarget = null; tipEl().classList.remove('show'); }
function placeTip(e) {
  const t = tipEl(), pad = 14;
  const w = t.offsetWidth, h = t.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + w > innerWidth - 8) x = e.clientX - w - pad;
  if (y + h > innerHeight - 8) y = e.clientY - h - pad;
  t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
}
function bindTips() {
  const SEL = '[data-unit],[data-tipunit],[data-pick],[data-item],[data-tipitem],[data-trait],[data-aug],[data-tip-text]';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest(SEL);
    if (!el) { if (tipTarget) hideTip(); return; }
    if (el === tipTarget) return;
    tipTarget = el;
    const html = tipHtml(el);
    if (!html) { hideTip(); return; }
    tipEl().innerHTML = html; tipEl().classList.add('show'); placeTip(e);
  });
  document.addEventListener('mousemove', e => { if (tipTarget) placeTip(e); });
  document.addEventListener('scroll', hideTip, true);
}

function showTab(name) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  ({ board: renderBoard, comps: renderComps, units: renderUnits, traits: renderTraits, items: renderItems, augments: renderAugments, tips: renderTips })[name]?.();
  hideTip();
  try { localStorage.setItem('tft-helper-tab', name); } catch {}
}

function init() {
  $('#meta').textContent = `${D.meta.setName || 'Set ' + D.meta.set} · ${String(D.meta.patch || '').toUpperCase()} · cập nhật ${new Date(D.meta.fetchedAt).toLocaleDateString('vi-VN')}`;
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#drawer-close').addEventListener('click', closeDrawer);

  // Chip lọc ở các tab
  const chipBind = (sel, key, fn, num = false) => $(sel).addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { ui[key] = num ? Number(c.dataset.v) : c.dataset.v; fn(); } });
  chipBind('#comp-level', 'compLevel', renderComps);
  chipBind('#unit-cost', 'unitCost', renderUnits, true);
  chipBind('#unit-trait', 'unitTrait', renderUnits);
  chipBind('#trait-type', 'traitType', renderTraits);
  chipBind('#item-kind', 'itemKind', renderItems);
  chipBind('#augment-rarity', 'augRarity', renderAugments);
  chipBind('#augment-tag', 'augTag', renderAugments);
  [['#comp-search', renderComps], ['#unit-search', renderUnits], ['#trait-search', renderTraits], ['#item-search', renderItems], ['#augment-search', renderAugments]]
    .forEach(([s, f]) => $(s).addEventListener('input', f));

  bindBoard();
  bindTips();

  // Bấm chung
  document.addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      e.preventDefault();
      const key = cp.dataset.copy;
      if (key.startsWith('comp:')) { const c = D.comps.find(x => x.id === key.slice(5)); if (c) copyTeam(c.units, 'đội ' + c.name); }
      else if (key.startsWith('units:')) copyTeam(key.slice(6).split(',').filter(Boolean), 'bàn cờ này');
      return;
    }
    const dn = e.target.closest('[data-done]'); if (dn) { state.done.push(dn.dataset.done); save(); renderOutput(); hideTip(); return; }
    const ul = e.target.closest('[data-unlocked]'); if (ul) { if (!state.unlocked.includes(ul.dataset.unlocked)) state.unlocked.push(ul.dataset.unlocked); save(); renderBoard(); hideTip(); toast(`🔓 Đã đánh dấu mở khoá <b>${esc(uname(ul.dataset.unlocked))}</b>`, 2000); return; }
    const pl = e.target.closest('[data-path-level]'); if (pl) { ui.pathLevel = Number(pl.dataset.pathLevel); ui.posFull = false; renderOutput(); return; }
    if (e.target.closest('[data-path-alt]')) { ui.pathAlt = !ui.pathAlt; renderOutput(); return; }
    if (e.target.closest('[data-pos-full]')) { ui.posFull = !ui.posFull; renderOutput(); return; }
    const st = e.target.closest('[data-set-target]'); if (st) { e.preventDefault(); setTarget(st.dataset.setTarget); return; }
    if (e.target.closest('[data-untarget]')) { state.target = null; save(); renderOutput(); hideTip(); return; }
    const gt = e.target.closest('[data-goto]'); if (gt) { e.preventDefault(); showTab(gt.dataset.goto); return; }
    const cd = e.target.closest('[data-comp-detail]'); if (cd) { e.preventDefault(); compDetail(cd.dataset.compDetail); return; }
    if (e.target.closest('#board-unit-pool, #mine-list, #opp-list, #component-picker, #aug-chosen, #steppers')) return;
    const u = e.target.closest('[data-unit]'); if (u && u.dataset.unit) { unitDetail(u.dataset.unit); return; }
    const it = e.target.closest('[data-item]'); if (it) { itemDetail(it.dataset.item); return; }
    const tr = e.target.closest('[data-trait]'); if (tr) { traitDetail(tr.dataset.trait); return; }
  });

  // Phím tắt
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); hideTip(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (!typing && /^[1-7]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey && $('#tab-board').classList.contains('active')) {
      state.activeOpp = Number(e.key) - 1; save(); renderOpps();
      toast(`Đang chọn <b>${esc(state.opponents[state.activeOpp].name)}</b> — bấm phải vào tướng để thêm`, 1500); return;
    }
    if (e.key === '/' && !typing) {
      e.preventDefault();
      if (!$('#tab-board').classList.contains('active')) showTab('board');
      $('#board-unit-search').focus(); $('#board-unit-search').select();
    }
  });

  let start = 'board'; try { start = localStorage.getItem('tft-helper-tab') || 'board'; } catch {}
  showTab(start);
}
init();
})();
