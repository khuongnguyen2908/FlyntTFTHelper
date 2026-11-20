// Ghi kết quả Claude đọc từ ảnh chụp game vào web/live.js để web tự cập nhật.
// Chạy: node scripts/write-live.mjs [file.json]   (mặc định shots/live-input.json)
//
// File vào (tên tướng / mảnh đồ ghi tiếng Việt hoặc tiếng Anh như trong game, hoặc mã DA_...):
// {
//   "kind": "self",                 // "self" = bàn của bạn, "opp" = đang soi nhà khác
//   "opp": "Tên người chơi",        // chỉ khi kind = "opp"
//   "shot": "shot-....png",         // tuỳ chọn
//   "stage": "3-2", "level": 6, "gold": 34, "hp": 72,   // không đọc được thì bỏ hoặc null
//   "units": ["Ahri", "Akali (True Damage)"],           // tướng trùng tên: ghi tộc trong ngoặc
//   "comps": {"Kiếm B.F.": 2, "Tear": 1},               // mảnh đồ đang có (chỉ kind = "self")
//   "advice": ["Dòng lời khuyên 1", "Dòng 2"]           // **chữ** = in đậm
// }
// Tên nào không khớp: báo lỗi, không ghi file (sửa tên rồi chạy lại).

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'set19');
const OUT = join(ROOT, 'web', 'live.js');
const inFile = process.argv[2] || join(ROOT, 'shots', 'live-input.json');

const [units, items, traits, input] = await Promise.all([
  readFile(join(DATA, 'units.json'), 'utf8').then(JSON.parse),
  readFile(join(DATA, 'items.json'), 'utf8').then(JSON.parse),
  readFile(join(DATA, 'traits.json'), 'utf8').then(JSON.parse),
  readFile(inFile, 'utf8').then(s => JSON.parse(s.replace(/^﻿/, ''))),
]);

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
const T = new Map(traits.map(t => [t.id, t]));
const errors = [];

function findUnit(raw) {
  const s = String(raw).trim();
  const byId = units.find(u => u.id === s); if (byId) return byId.id;
  const m = /^(.+?)\s*[(|\[]\s*(.+?)\s*[)\]]?$/.exec(s);
  const base = norm(m ? m[1] : s), hint = m ? norm(m[2]) : '';
  let c = units.filter(u => norm(u.name) === base || norm(u.nameEn) === base);
  if (!c.length) c = units.filter(u => norm(u.name).startsWith(base) || norm(u.nameEn).startsWith(base));
  if (c.length > 1 && hint) c = c.filter(u => u.traits.some(t => [T.get(t)?.name, T.get(t)?.nameEn, t].some(x => norm(x).includes(hint))));
  if (c.length === 1) return c[0].id;
  if (c.length > 1) errors.push(`Tướng "${s}" trùng tên, ghi kèm tộc: ${c.map(u => `${u.name} (${u.traits.map(t => T.get(t)?.nameEn || t).join(', ')})`).join(' / ')}`);
  else errors.push(`Không có tướng "${s}". Gần giống: ${units.filter(u => norm(u.nameEn).slice(0, 3) === base.slice(0, 3)).map(u => u.nameEn).join(', ') || '—'}`);
  return null;
}

const COMPONENTS = items.filter(i => i.kind === 'component');
const ALIAS = { bf: 'BFSword', sword: 'BFSword', kiem: 'BFSword', vest: 'ChainVest', giap: 'ChainVest', pan: 'FryingPan', chao: 'FryingPan',
  belt: 'GiantsBelt', dai: 'GiantsBelt', rod: 'NeedlesslyLargeRod', gay: 'NeedlesslyLargeRod', cloak: 'NegatronCloak', ao: 'NegatronCloak',
  bow: 'RecurveBow', cung: 'RecurveBow', gloves: 'SparringGloves', glove: 'SparringGloves', gang: 'SparringGloves',
  spatula: 'Spatula', xeng: 'Spatula', tear: 'TearOfTheGoddess', nuocmat: 'TearOfTheGoddess' };
function findComp(raw) {
  const s = String(raw).trim(), k = norm(s);
  const c = COMPONENTS.find(i => i.id === s || norm(i.name) === k || norm(i.nameEn) === k)
    || (ALIAS[k] && COMPONENTS.find(i => i.id.endsWith('_' + ALIAS[k])));
  if (c) return c.id;
  errors.push(`Không có mảnh đồ "${s}". Có: ${COMPONENTS.map(i => i.nameEn).join(', ')}`);
  return null;
}

const kind = input.kind === 'opp' ? 'opp' : 'self';
const out = { seq: Date.now(), at: new Date().toLocaleTimeString('vi-VN', { hour12: false }), kind };
if (input.shot) out.shot = basename(String(input.shot));
if (kind === 'opp') {
  out.opp = String(input.opp || '').trim().slice(0, 24);
  if (!out.opp) errors.push('kind = "opp" nhưng thiếu tên người chơi ("opp").');
}
if (Array.isArray(input.units)) out.units = [...new Set(input.units.map(findUnit).filter(Boolean))]; // bỏ trống = không đổi tướng trên web

if (kind === 'self') {
  const num = (k, lo, hi) => {
    if (input[k] == null || input[k] === '') return;
    const v = Number(input[k]);
    if (Number.isInteger(v) && v >= lo && v <= hi) out[k] = v; else errors.push(`${k} = ${input[k]} không hợp lệ (${lo}–${hi}).`);
  };
  if (input.stage != null && input.stage !== '') {
    if (/^[1-7]-[1-7]$/.test(String(input.stage))) out.stage = String(input.stage); else errors.push(`stage = ${input.stage} không đúng dạng "3-2".`);
  }
  num('level', 1, 10); num('gold', 0, 300); num('hp', 0, 100);
  if (input.comps != null) {
    out.comps = {};
    const list = Array.isArray(input.comps) ? input.comps.map(n => [n, 1]) : Object.entries(input.comps);
    for (const [n, c] of list) { const id = findComp(n); if (id) out.comps[id] = (out.comps[id] || 0) + Math.max(0, Number(c) || 0); }
  }
}
out.advice = (input.advice || []).map(s => String(s).trim()).filter(Boolean).slice(0, 6);

if (errors.length) { console.error('Chưa ghi live.js:\n- ' + errors.join('\n- ')); process.exit(1); }
await writeFile(OUT, '// Tự sinh bởi scripts/write-live.mjs (Claude đọc ảnh chụp game). Không sửa tay.\nwindow.TFT_LIVE = ' + JSON.stringify(out) + ';\n');
console.log(`Đã ghi web/live.js lúc ${out.at}: ${kind === 'opp' ? 'nhà ' + out.opp : 'bàn của bạn'}, ${out.units ? out.units.length + " tướng" : "giữ nguyên tướng"}` +
  (out.comps ? `, ${Object.values(out.comps).reduce((a, b) => a + b, 0)} mảnh` : '') + `, ${out.advice.length} dòng lời khuyên.`);
