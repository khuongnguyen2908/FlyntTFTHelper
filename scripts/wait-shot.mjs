// Chờ ảnh chụp màn hình mới (Win+PrtScn) rồi chép vào shots/ của dự án và thoát.
// Claude chạy lệnh này ở chế độ nền: lệnh thoát = có ảnh mới để đọc.
// Chạy: node scripts/wait-shot.mjs                 (tự tìm thư mục Screenshots của Windows)
//       node scripts/wait-shot.mjs --dir <thư mục>  (chỉ định thư mục ảnh)
//       node scripts/wait-shot.mjs --timeout 10800  (giây, mặc định 3 giờ)
// In ra: "SHOT <đường dẫn ảnh trong shots/>" hoặc "TIMEOUT".
// Mốc ảnh đã xử lý lưu ở shots/.last, nên ảnh chụp lúc Claude đang bận vẫn được nhận ở lần chạy sau.
// Nhiều ảnh mới cùng lúc: chỉ lấy ảnh mới nhất (ảnh cũ hơn đã lỗi thời).

import { readdir, stat, copyFile, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'shots');
const LAST = join(SHOTS, '.last');
const KEEP = 20;
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const TIMEOUT_MS = Number(arg('timeout') || 10800) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const expand = p => p.replace(/%([^%]+)%/g, (_, k) => process.env[k] ?? process.env[k.toUpperCase()] ?? `%${k}%`);

// Đọc thư mục từ registry (Windows cho phép dời Pictures / Screenshots, vd vào OneDrive).
function regFolder(name) {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = /REG_(?:EXPAND_)?SZ\s+(.+)\s*$/m.exec(out);
    return m ? expand(m[1].trim()) : null;
  } catch { return null; }
}
function candidateDirs() {
  if (arg('dir')) return [arg('dir')];
  const home = process.env.USERPROFILE || '';
  const pics = regFolder('My Pictures');
  const list = [
    regFolder('{B7BEDE81-DF94-4682-A7D8-57A52620B86F}'), // thư mục Screenshots
    pics && join(pics, 'Screenshots'),
    home && join(home, 'Pictures', 'Screenshots'),
    home && join(home, 'OneDrive', 'Pictures', 'Screenshots'),
  ].filter(Boolean);
  return [...new Set(list)];
}

async function newestAfter(dirs, since) {
  let best = null;
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    let names = [];
    try { names = await readdir(d); } catch { continue; }
    for (const n of names) {
      if (!/\.(png|jpe?g)$/i.test(n)) continue;
      const p = join(d, n);
      try {
        const s = await stat(p);
        if (s.mtimeMs > since && (!best || s.mtimeMs > best.mtime)) best = { path: p, mtime: s.mtimeMs, size: s.size };
      } catch {}
    }
  }
  return best;
}

async function prune() {
  const files = (await readdir(SHOTS)).filter(n => /^shot-.*\.(png|jpe?g)$/i.test(n)).sort();
  for (const n of files.slice(0, Math.max(0, files.length - KEEP))) await unlink(join(SHOTS, n)).catch(() => {});
}

await mkdir(SHOTS, { recursive: true });
const dirs = candidateDirs();
let since = Date.now();
try { const v = Number((await readFile(LAST, 'utf8')).trim()); if (v > 0) since = v; } catch {}
console.error('Đang chờ ảnh trong: ' + dirs.join(' | '));

const t0 = Date.now();
while (Date.now() - t0 < TIMEOUT_MS) {
  const f = await newestAfter(dirs, since);
  if (f) {
    // Chờ Windows ghi xong file (kích thước không đổi).
    let size = f.size;
    for (let i = 0; i < 10; i++) { await sleep(250); const s = (await stat(f.path)).size; if (s === size && s > 0) break; size = s; }
    const d = new Date(f.mtime), pad = n => String(n).padStart(2, '0');
    const ext = f.path.match(/\.\w+$/)[0].toLowerCase();
    const out = join(SHOTS, `shot-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ext}`);
    await copyFile(f.path, out);
    await writeFile(LAST, String(f.mtime));
    await prune();
    console.log('SHOT ' + out);
    process.exit(0);
  }
  await sleep(700);
}
console.log('TIMEOUT');
