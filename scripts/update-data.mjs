// Tải dữ liệu TFT (tướng, tộc hệ, trang bị, lõi, đội hình) từ MetaTFT, rút gọn, lưu vào data/ và web/data.js.
// Chạy: node scripts/update-data.mjs            (mặc định Set 19, đội hình PBE)
//       node scripts/update-data.mjs --set 19 --queue PBE
// Không cần cài thư viện (Node 18+ có sẵn fetch).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => s.trim().split(/\s+/))
);
const SET = args.set || '19';
const QUEUE = args.queue || 'PBE'; // PBE hoặc 1100 (rank bản chính thức)

const URL_LOOKUP = lang => `https://data.metatft.com/lookups/TFTSet${SET}_latest_${lang}.json`;
const URL_COMPS = `https://api-hc.metatft.com/tft-comps-api/comps_data?queue=${QUEUE}`;
const CDN = 'https://cdn.metatft.com/file/metatft';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (tft-helper)' } });
  if (!res.ok) throw new Error(`${res.status} khi tải ${url}`);
  return res.json();
}

// ---------- Dịch mô tả có thẻ <TFTCurveTable>, <TFTAttribute> ra chữ ----------
const ICON_LABEL = {
  'icon.ap': 'SMPT', 'icon.ad': 'SMCK', 'icon.health': 'Máu', 'icon.armor': 'Giáp', 'icon.mr': 'Kháng phép',
  'icon.magicresist': 'Kháng phép', 'icon.as': 'Tốc đánh', 'icon.attackspeed': 'Tốc đánh', 'icon.mana': 'Năng lượng',
  'icon.critchance': 'Chí mạng', 'icon.crit': 'Chí mạng', 'icon.shield': 'Khiên', 'icon.durability': 'Bền bỉ',
  'icon.omnivamp': 'Hút máu toàn phần', 'icon.dodge': 'Né', 'icon.dura': 'Bền bỉ', 'icon.damageamp': 'Khuếch đại ST',
  'icon.manaregen': 'Hồi năng lượng', 'icon.critdmg': 'ST chí mạng', 'icon.coin': 'Vàng',
};
function curveAt(table, row, col) {
  if (!table || !row) return null;
  let s = table[row];
  if (!s) {
    const k = Object.keys(table).find(o => o.trim().toLowerCase() === row.trim().toLowerCase());
    if (k) s = table[k];
  }
  if (!Array.isArray(s) || !s.length) return null;
  const c = Number.isFinite(Number(col)) ? Number(col) : 1;
  let v = null;
  for (const e of s) if (Array.isArray(e) && e[0] <= c) v = e[1];
  if (v === null) v = s[0][1];
  return typeof v === 'number' ? v : null;
}
function fmtNum(v, format, precision) {
  const f = String(format || '').toLowerCase();
  let x = v, pct = false;
  if (f === 'percent' || f === 'p') { x = v * 100; pct = true; }
  else if (f === 'percentminusone') { x = (v - 1) * 100; pct = true; }
  else if (f === 'invertedpercent') { x = (1 - v) * 100; pct = true; }
  const p = precision != null && precision !== '' ? Number(precision) : 2;
  const n = Math.pow(10, p);
  return String(Math.round(x * n) / n) + (pct ? '%' : '');
}
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];
// Số trong tooltip kèm icon: ghi chữ thay icon. TFTAttribute thì icon nghĩa là "tăng theo", để trong ngoặc.
function iconSuffix(tag, scaling) {
  const labels = (attr(tag, 'icon') || '').toLowerCase().split(',').map(s => ICON_LABEL[s.trim()]).filter(Boolean);
  if (!labels.length) return '';
  return scaling ? ` (${labels.join('+')})` : ' ' + labels.join('+');
}
function resolveText(text, obj) {
  if (!text) return '';
  let s = String(text);
  s = s.replace(/<TFTCurveTable\b[^>]*\/?>/gi, tag => {
    const v = curveAt(obj.curveValues, attr(tag, 'row'), attr(tag, 'column')) ??
              curveAt(obj.curveTable, attr(tag, 'row'), attr(tag, 'column'));
    return v == null ? '?' : fmtNum(v, attr(tag, 'format'), attr(tag, 'precision')) + iconSuffix(tag);
  });
  s = s.replace(/<TFTAttribute\b[^>]*\/?>/gi, tag => {
    const id = attr(tag, 'attributeId') || attr(tag, 'attributeID');
    const vals = obj.attributeValues?.[id] ?? obj.attributeCalcs?.[id]?.values;
    if (!Array.isArray(vals)) return '?';
    // Giá trị theo sao: chỉ hiện 1★/2★/3★.
    const pct = /percent/i.test(attr(tag, 'format') || '');
    const shown = vals.slice(0, 3).map(v => fmtNum(v, attr(tag, 'format'), attr(tag, 'precision') ?? (pct ? 1 : 0)));
    const same = shown.every(x => x === shown[0]);
    return (same ? shown[0] : shown.join('/')) + iconSuffix(tag, true);
  });
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<img[^>]*>/gi, '')
       .replace(/<[^>]+>/g, '')
       .replace(/%i:[^%]*%/g, '')
       .replace(/&nbsp;/g, ' ')
       .replace(/[ \t]+/g, ' ')
       .replace(/ *\n */g, '\n')
       .trim();
  return s;
}

// ---------- Rút gọn ----------
const icon = (kind, apiName) => `${CDN}/${kind}/${String(apiName).toLowerCase()}.png`;
const pick = (vi, en, key) => (vi && vi[key]) || (en && en[key]) || '';

function buildUnits(en, vi, roles) {
  const viMap = new Map(vi.units.map(u => [u.apiName, u]));
  return en.units.filter(u => u.shopUnit).map(u => {
    const v = viMap.get(u.apiName) || u;
    const s = u.stats || {};
    const ab = v.ability || u.ability || {};
    // Số trong mô tả kỹ năng lấy từ cả kỹ năng (theo sao) lẫn bảng số của tướng.
    const abCtx = { ...(u.ability || {}), ...ab, curveValues: u.curveValues, curveTable: u.curveTable };
    return {
      id: u.apiName,
      name: v.name || u.name,
      nameEn: u.name,
      cost: u.cost,
      code: u.code ? String(u.code).padStart(3, '0') : null, // mã tướng trong Team Planner của game
      traits: u.traitApiNames || [],
      role: roles[u.role] || u.role || '',
      icon: icon('champions', u.apiName),
      pool: u.poolCount ?? null,
      stats: {
        hp: s.hp, armor: s.armor, mr: s.magicResist, ad: s.damage, as: s.attackSpeed,
        range: s.range, mana: s.mana, startMana: s.initialMana,
      },
      ability: { name: ab.name || '', desc: resolveText(ab.desc, abCtx) },
      unlockLevel: u.unlock?.levelRequired ?? null,
      unlock: u.unlock ? (resolveText((v.unlock && v.unlock.text) || u.unlock.text || u.unlock.manual_conditions, { ...u, ...(v.unlock || {}) }) || u.unlock.manual_conditions || 'Cần mở khoá') : null,
    };
  });
}

function buildTraits(en, vi) {
  const viMap = new Map(vi.traits.map(t => [t.apiName, t]));
  return en.traits.map(t => {
    const v = viMap.get(t.apiName) || t;
    const type = t.type || 'origin';
    return {
      id: t.apiName,
      name: v.name || t.name,
      nameEn: t.name,
      type, // origin | class | unique
      desc: resolveText(v.desc || t.desc, t),
      steps: (v.effects || t.effects || []).map((e, i) => ({
        min: e.minUnits, max: e.maxUnits, style: e.style,
        desc: resolveText(e.desc || (t.effects?.[i]?.desc) || '', t),
      })).map(s => (/^placeholder/i.test(s.desc) ? { ...s, desc: '' } : s)), // dữ liệu PBE còn dòng tạm
      units: (t.units || []).map(x => x.unit),
      icon: icon('traits', t.apiName),
    };
  }).filter(t => t.units.length || t.type !== 'unique');
}

function itemKind(i) {
  const tags = (i.tags || []).join(' ');
  if (/Item\.Component\b/.test(tags) && !/SpatOrPan/.test(tags) || /^DA_Component_/.test(i.apiName)) return 'component';
  if (/Emblem/.test(tags) || /Emblem/.test(i.apiName)) return 'emblem';
  if (/Radiant/.test(tags)) return 'radiant';
  if (/Artifact/.test(tags)) return 'artifact';
  if (/Support/.test(tags)) return 'support';
  if (/Craftable/.test(tags)) return 'craftable';
  return 'other';
}
function buildItems(en, vi) {
  const viMap = new Map(vi.items.map(i => [i.apiName, i]));
  return en.items.map(i => {
    const v = viMap.get(i.apiName) || i;
    const cat = (i.tags || []).filter(t => /Category\./.test(t)).map(t => t.split('.').pop().toLowerCase());
    return {
      id: i.apiName,
      name: v.name || i.name,
      nameEn: i.name,
      kind: itemKind(i),
      from: i.composition || [],
      cat, // attack | magic | tank
      unique: !!i.unique,
      desc: resolveText(v.desc || i.desc, i),
      stats: resolveText(v.statLine || i.statLine, i),
      traits: i.associatedTraits || [],
      icon: icon('items', i.apiName),
    };
  }).filter(i => i.name);
}

function buildAugments(en, vi) {
  const viMap = new Map(vi.augments.map(a => [a.apiName, a]));
  return en.augments.map(a => {
    const v = viMap.get(a.apiName) || a;
    return {
      id: a.apiName,
      name: v.name || a.name,
      nameEn: a.name,
      rarity: a.rarity, // Silver | Gold | Prismatic
      type: a.type, // regular | trait
      tags: a.manual_tags || [],
      rounds: a.rounds || [],
      traits: a.associatedTraits || [],
      desc: resolveText(v.desc || a.desc, a),
      icon: icon('augments', a.apiName),
    };
  }).filter(a => a.name);
}

const LEVELLING_VI = {
  'lvl 5': 'Reroll cấp 5', 'lvl 6': 'Reroll cấp 6', 'lvl 7': 'Roll cấp 7',
  'Standard': 'Tiêu chuẩn (roll cấp 8)', 'Fast 8': 'Lên nhanh cấp 8', 'Fast 9': 'Lên nhanh cấp 9',
};
function buildComps(raw, nameOf) {
  const d = raw.results.data;
  const comps = Object.values(d.cluster_details).map(c => {
    const units = c.units_string.split(',').map(s => s.trim()).filter(Boolean);
    const traits = c.traits_string.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(.*)_(\d+)$/);
      return { id: m ? m[1] : s, tier: m ? Number(m[2]) : 1 };
    });
    const builds = (c.builds || []).map(b => ({
      unit: b.unit, items: b.buildName || [], avg: b.avg, count: b.count,
    }));
    const title = (c.name || []).map(n => nameOf(n.name)).filter(Boolean).join(' + ') ||
      (c.name_string || '').split(',').map(s => nameOf(s.trim())).join(' + ');
    const last = (c.trends || []).at(-1);
    return {
      id: String(c.Cluster),
      name: title,
      units, traits, builds,
      carries: builds.map(b => b.unit),
      topItems: (c.top_itemNames || []).slice(0, 8).map(x => x.itemName),
      count: c.overall?.count ?? 0,
      avg: c.overall?.avg ?? null,
      pick: last?.pick ?? null,
      levelling: c.levelling,
      levellingVi: LEVELLING_VI[c.levelling] || c.levelling,
      extraUnits: (c.stars || []).filter(u => !units.includes(u)).slice(0, 8),
    };
  });
  const total = comps.reduce((s, c) => s + c.count, 0) || 1;
  // Xếp hạng: chỉ tính các đội đủ số trận, rồi chia bậc theo hạng trung bình.
  const minGames = total * 0.004;
  const ranked = comps.filter(c => c.count >= minGames && c.avg != null).sort((a, b) => a.avg - b.avg);
  ranked.forEach((c, i) => {
    const q = i / ranked.length;
    c.tier = q < 0.12 ? 'S' : q < 0.35 ? 'A' : q < 0.65 ? 'B' : q < 0.88 ? 'C' : 'D';
  });
  comps.forEach(c => { c.tier ||= '?'; c.share = c.count / total; });
  comps.sort((a, b) => (a.tier === '?') - (b.tier === '?') || (a.avg ?? 9) - (b.avg ?? 9));
  return { set: d.tft_set, clusterId: d.cluster_id, totalGames: total, comps };
}

// ---------- Lộ trình theo cấp: bàn cờ phổ biến ở từng cấp của mỗi đội ----------
// Mã tướng trong số liệu theo cấp đôi khi là mã cũ (DA_18_Kobuko, DA_SeraphineIndie19...) → quy về mã tướng hiện tại.
function makeUnitResolver(en, units) {
  const known = new Set(units.map(u => u.id));
  const assets = en.unitAssetNames || {};
  const enName = new Map(en.units.map(u => [u.apiName, u.name]));
  const byName = new Map();
  units.forEach(u => { const k = u.nameEn.toLowerCase().replace(/[^a-z]/g, ''); byName.set(k, byName.has(k) ? null : u.id); }); // null = trùng tên, không đoán
  const viaName = n => (n ? byName.get(String(n).toLowerCase().replace(/[^a-z]/g, '')) : null) || null;
  const nonShop = new Set(en.units.filter(u => !u.shopUnit).map(u => u.apiName));
  // Vật đặt trên bàn, không phải tướng (nhạc cụ Beach Pop, hình nộm, tượng...) → bỏ qua, vẫn giữ bàn.
  const OBJECT_RE = /Maracas|Bongos|Rainstick|Panflute|Ukelele|Steeldrum|TrainingDummy|VoidSpawn|InfernalIdol|GoldenEgg|Golem/i;
  const cache = new Map();
  return raw => {
    if (cache.has(raw)) return cache.get(raw);
    let id = null;
    if (OBJECT_RE.test(raw) || (nonShop.has(raw) && !known.has(raw)) || (nonShop.has(assets[raw]) && !viaName(enName.get(assets[raw])))) id = SKIP;
    else if (known.has(raw)) id = raw;
    else if (known.has(assets[raw])) id = assets[raw];
    else if (assets[raw] && viaName(enName.get(assets[raw]))) id = viaName(enName.get(assets[raw]));
    else {
      const m = raw.match(/^DA_18_(.+)$/);
      if (m) { const base = m[1].replace(/(Small|Big|Mega)$/, ''); id = [`DA_${base}19`, `DA_19_${base}`].find(x => known.has(x)) || viaName(base); }
    }
    cache.set(raw, id);
    return id;
  };
}
const SKIP = '__skip__';
function pickBoards(list, resolve, lost) {
  const boards = [];
  for (const o of list || []) {
    const raw = String(o.unit_list || o.units_list || '').split('&').filter(Boolean);
    const ids = raw.map(resolve);
    if (ids.some(x => !x)) { raw.forEach((r, i) => { if (!ids[i]) lost.add(r); }); continue; } // tướng lạ (vd Set cũ) thì bỏ cả bàn, tránh hiện sai
    const units = [...new Set(ids.filter(x => x !== SKIP))];
    if (units.length) boards.push({ units, count: o.count, avg: o.avg, win: o.win ?? null });
  }
  if (!boards.length) return [];
  const main = boards.reduce((a, b) => (b.count > a.count ? b : a));
  const alts = boards.filter(b => b !== main && b.count >= main.count * 0.25).sort((a, b) => a.avg - b.avg).slice(0, 2);
  return [main, ...alts];
}
async function fetchLevelPaths(comps, clusterId, resolve) {
  const lost = new Set();
  let ok = 0, fail = 0;
  const queue = [...comps];
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      try {
        const url = `https://api-hc.metatft.com/tft-comps-api/comp_details?comp=${c.id}&cluster_id=${clusterId}&queue=${QUEUE}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (tft-helper)' }, signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()).results || {};
        const stageOf = {};
        (r.levels || []).forEach(l => { if (l.stage && l.round) stageOf[l.level] = `${l.stage}-${l.round}`; });
        const levels = {};
        for (let L = 4; L <= 10; L++) {
          const src = r.early_options?.[L]?.length ? r.early_options[L] : r.options?.[L];
          const boards = pickBoards(src, resolve, lost);
          if (boards.length) levels[L] = { stage: stageOf[L] || null, boards };
        }
        if (Object.keys(levels).length) { c.path = levels; ok++; } else fail++;
      } catch { fail++; }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { ok, fail, lost: [...lost] };
}

// Đồ hay lên cho từng tướng: gộp từ build của các đội hình (theo số trận).
function buildUnitItems(comps) {
  const map = {};
  for (const c of comps) for (const b of c.builds) {
    const u = (map[b.unit] ||= { items: {}, builds: [] });
    b.items.forEach(it => {
      const x = (u.items[it] ||= { count: 0, sum: 0 });
      x.count += b.count; x.sum += b.avg * b.count;
    });
    u.builds.push({ comp: c.id, items: b.items, avg: b.avg, count: b.count });
  }
  const out = {};
  for (const [unit, u] of Object.entries(map)) {
    out[unit] = {
      items: Object.entries(u.items).map(([id, x]) => ({ id, count: x.count, avg: +(x.sum / x.count).toFixed(2) }))
        .sort((a, b) => b.count - a.count).slice(0, 10),
      builds: u.builds.sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }
  return out;
}

async function main() {
  console.log(`Đang tải dữ liệu Set ${SET}, đội hình queue=${QUEUE} ...`);
  const [en, vi, compsRaw] = await Promise.all([
    getJson(URL_LOOKUP('en_us')),
    getJson(URL_LOOKUP('vi_vn')).catch(e => { console.warn('Không có bản tiếng Việt, dùng tiếng Anh:', e.message); return null; }),
    getJson(URL_COMPS).catch(e => { console.warn('Không tải được đội hình:', e.message); return null; }),
  ]);
  const viData = vi || en;
  const roles = {};
  for (const [k, r] of Object.entries(viData.roleData || {})) roles[k] = r.name;

  const units = buildUnits(en, viData, roles);
  // Mã trùng nhau giữa nhiều tướng (dữ liệu PBE chưa chuẩn) thì bỏ, tránh tạo mã đội sai.
  const codeCount = {};
  units.forEach(u => { if (u.code) codeCount[u.code] = (codeCount[u.code] || 0) + 1; });
  units.forEach(u => { if (u.code && codeCount[u.code] > 1) u.code = null; });
  const traits = buildTraits(en, viData);
  const items = buildItems(en, viData);
  const augments = buildAugments(en, viData);

  const nameIdx = new Map();
  [...units, ...traits, ...items].forEach(x => { if (!nameIdx.has(x.id)) nameIdx.set(x.id, x.name); });
  const nameOf = id => nameIdx.get(id) || id.replace(/^DA_|19$|_.*$/g, '');

  // --strict (dùng trên GitHub Actions): thiếu đội hình thì dừng, không ghi đè dữ liệu cũ bằng dữ liệu rỗng.
  if ('strict' in args && !compsRaw?.results?.data?.cluster_details) throw new Error('Không có dữ liệu đội hình (--strict).');
  let comps = null;
  if (compsRaw?.results?.data?.cluster_details) {
    comps = buildComps(compsRaw, nameOf);
    if (comps.set !== `TFTSet${SET}` && 'strict' in args) throw new Error(`Đội hình là của ${comps.set}, không phải Set ${SET} (--strict).`);
    if (comps.set !== `TFTSet${SET}`) console.warn(`Chú ý: đội hình là của ${comps.set}, không phải Set ${SET}.`);
    console.log(`Đang tải lộ trình theo cấp cho ${comps.comps.length} đội...`);
    const lp = await fetchLevelPaths(comps.comps, comps.clusterId, makeUnitResolver(en, units));
    console.log(`Lộ trình theo cấp: ${lp.ok} đội có, ${lp.fail} đội thiếu.${lp.lost.length ? ' Mã tướng không quy đổi được (bỏ bàn đó): ' + lp.lost.join(', ') : ''}`);
  }

  const data = {
    meta: {
      set: SET, setKey: en._metadata?.set || `TFTSet${SET}`, setName: en._metadata?.setName, patch: en._metadata?.patch, release: en._metadata?.release,
      dataGenerated: en._metadata?.generated, compsQueue: QUEUE, compsSet: comps?.set,
      compsGames: comps?.totalGames, fetchedAt: new Date().toISOString(),
      lang: vi ? 'vi_vn' : 'en_us',
    },
    units, traits, items, augments,
    comps: comps?.comps || [],
    unitItems: comps ? buildUnitItems(comps.comps) : {},
  };

  const dir = join(ROOT, 'data', `set${SET}`);
  await mkdir(dir, { recursive: true });
  for (const k of ['units', 'traits', 'items', 'augments', 'comps', 'unitItems', 'meta']) {
    await writeFile(join(dir, `${k}.json`), JSON.stringify(data[k], null, 1));
  }
  await mkdir(join(ROOT, 'web'), { recursive: true });
  await writeFile(join(ROOT, 'web', 'data.js'), `// Tạo tự động bởi scripts/update-data.mjs — đừng sửa tay.\nwindow.TFT_DATA = ${JSON.stringify(data)};\n`);

  console.log(`Xong: ${units.length} tướng, ${traits.length} tộc hệ, ${items.length} trang bị, ${augments.length} lõi, ${data.comps.length} đội hình (${comps?.totalGames ?? 0} trận).`);
  console.log(`Đã lưu: data/set${SET}/*.json và web/data.js`);
}

main().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });
