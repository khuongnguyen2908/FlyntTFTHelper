# Ghi chú làm tiếp (cập nhật 20/11/2026, lần 6)

## Mở dự án ở máy mới
- Cài Node.js 18+ (máy hiện tại: Node 24.14). Python chỉ dùng để chạy server xem thử (không bắt buộc).
- Chép / clone thư mục, chạy `node scripts/update-data.mjs` để tải dữ liệu mới, rồi mở `web/index.html`.

## Đang ở đâu
- Đã xong (20/11/2026):
  - Cài quy trình làm việc.
  - Script tải dữ liệu Set 19 từ MetaTFT.
  - Web tra cứu 7 tab: Tình huống của tôi, Đội hình mạnh, Tướng, Tộc hệ, Trang bị, Lõi, Mẹo nhanh.
  - Skill tư vấn `tft-tu-van` (đọc ảnh chụp game).
  - Lần 2: nút Copy mã đội hình; khung "Đội đang nhắm" (mức khớp, việc nên làm, đồ cần, lõi hợp).
  - Lần 6: khung 🔔 Nhắc việc (mở khoá tướng + lõi nhiệm vụ, nút Đã xong / Đã mở khoá) và nút 🆕 Ván mới. Chưa push.
    Luật nằm trong `web/app.js`: `unlockCheck()` (đọc điều kiện tiếng Anh bằng regex) và `AUG_RULES` (lõi nhiệm vụ theo id). Riot đổi câu điều kiện thì regex có thể không khớp → rơi về "Tự theo dõi trong game".
  - Lần 5: lộ trình theo cấp (bàn cờ cấp 4–10 cho từng đội) trong khung Đội đang nhắm và chi tiết đội. Đã push.
  - Lần 3: làm lại giao diện: tối kiểu TFT, tab Tình huống 2 cột vừa một màn hình (nhập trái / kết quả phải), chọn tướng chuột trái/phải + phím (/ , Enter, Shift+Enter), nút −/+ cho vòng/cấp/vàng/máu, ô thông tin khi rê chuột, chi tiết mở ở ngăn trượt bên phải, lọc bằng chip. Đã thử ở 1920×1000 và 1366×768.
- Mã đội hình: "02" + 10 ô × mã 3 ký tự (`units.json` → `code`, "000" = trống) + `meta.setKey`, theo đúng cách MetaTFT tạo.
  Chưa thử dán vào game thật. Mã trùng giữa nhiều tướng (PBE: Graves / Mordekaiser / Nasus cùng `449`) bị script bỏ (`code: null`).
- Dữ liệu: Set 19 bản PBE. Đội hình lấy từ queue PBE.
- Chưa có:
  - Số liệu tỉ lệ thắng của lõi Set 19 (MetaTFT chưa có cho PBE).
  - Số liệu tướng / đồ riêng (các API thống kê của MetaTFT vẫn trả Set 18).
- Khi Set 19 lên bản chính thức (~1/12/2026): chạy script với `--queue 1100`, kiểm tra lại đội hình. Xem API thống kê lõi đã có Set 19 chưa (`api-hc.metatft.com/tft-stat-api/augments_tiers`).
- Chưa quyết: có thêm số liệu lõi vào web khi có nguồn không.

## Công cụ
- **Kiểu làm việc:** B (sửa trực tiếp). Không có công cụ ngoài giữ file.
- **Ngôn ngữ:** JavaScript thuần. Không cài thư viện, không có bước build.
- **File tự sinh, không sửa tay:** `web/data.js` và `data/set19/*.json` (do `scripts/update-data.mjs` tạo).
- **File sửa thẳng:**
  - `scripts/update-data.mjs`: tải và rút gọn dữ liệu, dịch thẻ số trong mô tả.
  - `web/index.html`, `web/app.js` (phần tính toán ở đầu file, phần hiển thị theo từng tab), `web/style.css` (biến màu ở `:root`).
  - `.claude/skills/tft-tu-van/SKILL.md`.
- **Nguồn dữ liệu (MetaTFT, không chính thức):**
  - `data.metatft.com/lookups/TFTSet19_latest_{en_us|vi_vn}.json`: tướng, tộc hệ, đồ, lõi.
  - `api-hc.metatft.com/tft-comps-api/comps_data?queue=PBE`: đội hình.
  - `api-hc.metatft.com/tft-comps-api/comp_details?comp=<id>&cluster_id=<cluster>&queue=PBE`: chi tiết từng đội; dùng `early_options` (bàn cấp 4–7), `options` (cấp 7–10), `levels` (vòng lên cấp). Mã tướng cũ (`DA_18_X`, Seraphine các dạng) quy đổi trong `makeUnitResolver`; vật trên bàn (nhạc cụ Beach Pop, hình nộm...) bỏ qua; bàn có tướng Set cũ bị bỏ. Kết quả ở `comps[].path[cấp] = { stage, boards: [chính, thay thế 1, 2] }`.
  - Ảnh: `cdn.metatft.com/file/metatft/{champions|items|traits|augments}/<apiName viết thường>.png`.
- **Lệnh kiểm tra:**
  - `node --check web/app.js`
  - `node scripts/update-data.mjs`: chạy được và in ra số tướng / đội hình.
- **Cách tự chạy thử:**
  - Trình duyệt tích hợp không chạy JS khi mở file trực tiếp. Dùng cấu hình `tft-web` trong `.claude/launch.json`: server Python ở `http://localhost:8765`, thư mục `web/`.
  - Người dùng thì bấm đúp `web/index.html` là chạy.
  - Khi thử: đặt cỡ màn hình 1920×1000 và 1366×768 (người dùng mở trên màn hình thứ 2).
- **Lệnh quen của người dùng:**
  - "cập nhật dữ liệu" = chạy `node scripts/update-data.mjs` (đã được đồng ý sẵn, không cần hỏi lại).
  - Dán ảnh game / hỏi về TFT = tư vấn theo skill `tft-tu-van`, trả lời luôn.

## Build và phát hành
- Không có bước build. Repo: https://github.com/khuongnguyen2908/FlyntTFTHelper (nhánh `main`, công khai).
- Bản online: https://khuongnguyen2908.github.io/FlyntTFTHelper/ (GitHub Pages, nguồn = GitHub Actions).
- Workflow `.github/workflows/pages.yml`: chạy khi push `main`, hằng ngày 03:00 UTC, hoặc bấm tay. Chạy `node scripts/update-data.mjs --strict` (lỗi thì giữ dữ liệu trong repo) rồi đưa `web/` lên.
- `--strict`: thiếu đội hình hoặc đội hình không đúng Set thì dừng, không ghi file.
- Khi Set 19 lên bản chính thức: sửa lệnh trong workflow thành `--strict --queue 1100` (nếu không, khi PBE chuyển sang Set sau, chế độ strict sẽ dừng và web giữ dữ liệu cũ).
- Chỉ push khi người dùng bảo.

## Quy tắc riêng khi sửa
- Người dùng chơi TFT nhiều, hiểu cơ chế: tư vấn ngắn, đi thẳng vào việc cần làm.
- Giao diện: ít chữ, dùng biểu tượng + câu ngắn, giải thích dài để trong ⓘ (rê chuột). Không bắt cuộn cả trang ở tab Tình huống.
- Không bịa số liệu. Dữ liệu PBE luôn ghi rõ là tham khảo.
- Chữ hiển thị trong web viết tiếng Việt. Dữ liệu từ ngoài luôn đi qua `esc()` trước khi chèn HTML.
