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
const LEVELS = [...new Set(D.comps.map(c => c.levellingVi))];
const COSTS = [...new Set(D.units.map(u => u.cost))].sort((a, b) => a - b);
const ROUNDS = ['1-2', '1-3', '1-4'];
for (let s = 2; s <= 7; s++) for (let r = 1; r <= 7; r++) ROUNDS.push(`${s}-${r}`);

const KEY = 'tft-helper-state-v1';
const state = Object.assign(
  { mine: [], contested: [], comps: {}, augs: [], stage: '', level: 5, gold: 20, hp: 100, target: null },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
// Bộ lọc giao diện (không lưu)
const ui = { pathLevel: null, pathAlt: false, poolCost: 0, compLevel: '', unitCost: 0, unitTrait: '', traitType: '', itemKind: 'craftable', augRarity: '', augTag: '' };

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
    `${u.unlock ? '<span class="lock">🔒</span>' : ''}</span>`;
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

function scoreComp(c) {
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
  $('#contested-list').innerHTML = state.contested.length ? state.contested.map(id => uIcon(id, { size: 'sm', attr: `data-rm-cont="${esc(id)}" data-tipunit="${esc(id)}"` })).join('')
    : '<span class="empty">Bấm phải vào tướng để đánh dấu nhà khác đang giữ.</span>';
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
  </div>`;
}

function renderTargetView(c) {
  const a = targetAnalysis(c);
  const ranked = D.comps.map(scoreComp).sort((x, y) => y.s - x.s);
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
  const locked = buyOrder.filter(u => U.get(u)?.unlock);
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
    ${levelPathCard(c, a.mine)}
    <div class="cards2">
      <div class="card"><div class="card-title">📋 Việc cần làm</div>${linesHtml(todo)}</div>
      <div class="card"><div class="card-title">🛒 Mua / bán</div>
        <div class="sub-title">Mua theo thứ tự</div>
        <div class="icons">${buyOrder.map(u => uIcon(u, { size: 'sm', contested: a.cont.has(u) })).join('') || '<span class="good">Đã đủ tướng 👍</span>'}</div>
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

function renderOutput() {
  const out = $('#board-output');
  const target = state.target && D.comps.find(c => c.id === state.target);
  if (target) { out.innerHTML = renderTargetView(target); return; }
  const empty = !state.mine.length && !compTotal(state.comps);
  if (empty) {
    const top = D.comps.filter(c => c.tier !== '?').slice(0, 4).map(c => ({ c, why: [] }));
    out.innerHTML = `<div class="card welcome"><h2>Chào bạn 👋</h2>
        <div class="muted">Nhập tình huống ở cột trái, tool sẽ gợi ý đội hợp nhất, việc cần làm, đồ và lõi.</div>
        <div class="steps3"><div><b>1. Tướng</b>Bấm trái: của bạn · bấm phải: nhà khác đang tranh. Gõ tên + Enter cho nhanh.</div>
        <div><b>2. Mảnh đồ</b>Bấm trái thêm, bấm phải bớt.</div><div><b>3. Nhắm đội</b>Bấm 🎯 Nhắm để xem kế hoạch chi tiết và copy mã đội.</div></div></div>
      <div class="card"><div class="card-title">📋 Bước tiếp theo</div>${linesHtml(tempoLines(null))}</div>
      <div class="section-title">Đội mạnh nhất hiện tại</div>${top.map(r => suggCard(r)).join('')}`;
    return;
  }
  const ranked = D.comps.map(scoreComp).sort((a, b) => b.s - a.s).slice(0, 5);
  const now = compTotal(state.comps) ? craftableNow(state.comps) : [];
  out.innerHTML = `<div class="cards2">
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
function addContested(id) { if (!state.contested.includes(id)) state.contested.push(id); save(); renderTrays(); markPool(); renderOutput(); }
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
      toast(`${e.shiftKey ? '⚔ Nhà khác tranh' : '✅ Đã thêm'}: <b>${esc(first.name)}</b>`, 1500);
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
  $('#contested-list').addEventListener('click', e => {
    const t = e.target.closest('[data-rm-cont]'); if (!t) return;
    state.contested = state.contested.filter(x => x !== t.dataset.rmCont); save(); renderTrays(); markPool(); renderOutput(); hideTip();
  });
  $('#clear-units').addEventListener('click', () => { state.mine = []; state.contested = []; save(); renderBoardState(); });
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
  const addAug = id => { if (!state.augs.includes(id)) state.augs.push(id); as.value = ''; sug.classList.remove('show'); save(); renderAugChosen(); renderOutput(); };
  as.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = sug.querySelector('[data-add-aug]'); if (f) addAug(f.dataset.addAug); } if (e.key === 'Escape') { as.value = ''; sug.classList.remove('show'); } });
  as.addEventListener('blur', () => setTimeout(() => sug.classList.remove('show'), 150));
  sug.addEventListener('mousedown', e => { const el = e.target.closest('[data-add-aug]'); if (el) { e.preventDefault(); addAug(el.dataset.addAug); } });
  $('#aug-chosen').addEventListener('click', e => {
    const el = e.target.closest('[data-rm-aug]'); if (!el) return;
    state.augs.splice(Number(el.dataset.rmAug), 1); save(); renderAugChosen(); renderOutput(); hideTip();
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
    const pl = e.target.closest('[data-path-level]'); if (pl) { ui.pathLevel = Number(pl.dataset.pathLevel); renderOutput(); return; }
    if (e.target.closest('[data-path-alt]')) { ui.pathAlt = !ui.pathAlt; renderOutput(); return; }
    const st = e.target.closest('[data-set-target]'); if (st) { e.preventDefault(); setTarget(st.dataset.setTarget); return; }
    if (e.target.closest('[data-untarget]')) { state.target = null; save(); renderOutput(); hideTip(); return; }
    const gt = e.target.closest('[data-goto]'); if (gt) { e.preventDefault(); showTab(gt.dataset.goto); return; }
    const cd = e.target.closest('[data-comp-detail]'); if (cd) { e.preventDefault(); compDetail(cd.dataset.compDetail); return; }
    if (e.target.closest('#board-unit-pool, #mine-list, #contested-list, #component-picker, #aug-chosen, #steppers')) return;
    const u = e.target.closest('[data-unit]'); if (u && u.dataset.unit) { unitDetail(u.dataset.unit); return; }
    const it = e.target.closest('[data-item]'); if (it) { itemDetail(it.dataset.item); return; }
    const tr = e.target.closest('[data-trait]'); if (tr) { traitDetail(tr.dataset.trait); return; }
  });

  // Phím tắt
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); hideTip(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
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
