# Sổ bài học

Những lỗi đã gặp và đã sửa. Trước mỗi việc có sửa file: đọc **Luôn nhớ** và **Mục lục**, rồi chỉ đọc nhóm khớp với việc sắp làm.
Quy trình và lúc nào cần ghi: `.claude/skills/quy-trinh-lam-viec/SKILL.md`.

## Luôn nhớ
- Sửa file bằng đoạn code dài (nhiều dấu nháy, backtick, `${}`): ghi script ra thư mục scratchpad rồi chạy `python -I <file>`, đừng nhét vào heredoc trong lệnh bash (bị lỗi "unexpected EOF").

## Mục lục
| Nhóm | Đọc khi | Các bài |
|---|---|---|
| 1. Dữ liệu | Sửa `scripts/update-data.mjs` hoặc dữ liệu trong `data/` | |
| 2. Web | Sửa `web/` | CSS cũ bị lưu đệm khi thử; Nút bấm không thấy kết quả; Trình duyệt tích hợp không chạy JS của file:// |
| 3. Tư vấn | Sửa skill `tft-tu-van` hoặc khi tư vấn sai | Claude đọc ảnh quá chậm để dùng trong ván |
| 4. Đọc màn hình | Sửa `scripts/ocr-live.ps1` | OCR Windows bỏ sót số đứng riêng |

Mẫu một bài (ghi vào đúng nhóm, mới nhất lên đầu nhóm; trùng chủ đề thì bổ sung bài cũ; tối đa khoảng 8 dòng):

    ### Tên lỗi
    - Ngày: dd/mm/yyyy
    - Chuyện gì xảy ra: người dùng thấy gì
    - Nguyên nhân: vì sao bị
    - Đã sửa thế nào: file, chỗ nào
    - Lần sau tránh bằng cách: làm gì cụ thể để không bị lại

---

## 1. Dữ liệu

## 2. Web

### Thêm nút cạnh lưới làm cột trái tràn ngang ở 1366
- Ngày: 20/11/2026
- Chuyện gì xảy ra: thêm nút Ván mới cạnh 4 ô Vòng / Cấp / Vàng / Máu, ở màn 1366 nút bị đẩy ra ngoài cột (tràn 61px).
- Nguyên nhân: lưới dùng `1fr` (không co nhỏ hơn nội dung) và ô số có `width: 48px` cố định.
- Đã sửa thế nào: `web/style.css` `.steppers` dùng `repeat(4, minmax(0, 1fr))`, `min-width: 0`; ô nhập `width: 100%; min-width: 0`.
- Lần sau tránh bằng cách: lưới / flex chứa ô nhập luôn dùng `minmax(0, 1fr)` và `min-width: 0`. Sau mỗi lần thêm phần tử vào cột, đo `scrollWidth - clientWidth` của cột ở 1366.

### CSS / JS cũ bị lưu đệm khi tự thử trên server
- Ngày: 20/11/2026
- Chuyện gì xảy ra: sửa `style.css` rồi tải lại trang trong trình duyệt tích hợp, giao diện vẫn như cũ.
- Nguyên nhân: server Python (`http.server`) không cấm lưu đệm, trình duyệt dùng lại file cũ.
- Đã sửa thế nào: ép tải lại bằng JS: `await Promise.all(['style.css','app.js','index.html','data.js'].map(f=>fetch(f,{cache:'reload'}))); location.reload()`.
- Lần sau tránh bằng cách: sau mỗi lần sửa file web, ép tải lại như trên trước khi chụp màn hình. Kiểm tra bằng `getComputedStyle` nếu nghi ngờ. Nhắc người dùng Ctrl+F5.

### Bấm "Nhắm đội này" mà không thấy gì
- Ngày: 20/11/2026
- Chuyện gì xảy ra: bấm Nhắm đội ở tab Đội hình, sang tab Tình huống không thấy gì (người dùng phát hiện).
- Nguyên nhân: thông tin đội đang nhắm chỉ hiện vài dòng ở cuối trang, dưới bảng chọn tướng. Bàn trống thì gần như không có nội dung.
- Đã sửa thế nào: `web/app.js` thêm `renderTarget()` (khung `#target-panel` ở đầu tab), tự cuộn tới và nháy viền khi vừa nhắm. Bàn trống vẫn hiện kế hoạch đầy đủ.
- Lần sau tránh bằng cách: nút nào đổi trạng thái thì kết quả phải hiện ngay chỗ người dùng nhìn (đầu trang / cuộn tới). Thử cả lúc chưa nhập gì (trạng thái trống).

### Trình duyệt tích hợp không chạy JS của file://
- Ngày: 20/11/2026
- Chuyện gì xảy ra: mở `web/index.html` bằng file:// trong trình duyệt tích hợp, trang hiện chữ trơn, không có CSS / JS.
- Nguyên nhân: trình duyệt tích hợp hiện file ngoài server thành bản chụp tĩnh.
- Đã sửa thế nào: thêm cấu hình `tft-web` vào `.claude/launch.json` (server Python, cổng 8765, thư mục `web/`).
- Lần sau tránh bằng cách: muốn tự thử web thì luôn `preview_start` với `tft-web`, không mở file://. Người dùng bấm đúp file thì vẫn chạy bình thường.

## 3. Tư vấn

### Claude đọc ảnh quá chậm để dùng trong ván
- Ngày: 20/11/2026
- Chuyện gì xảy ra: chế độ Win+PrtScn → Claude đọc ảnh → web: mỗi ảnh 20–46 giây, xử lý từng ảnh một; người dùng thấy không dùng được khi đang chơi. Claude cũng không nhận ra chắc tướng trên bàn (hình 3D nhỏ).
- Nguyên nhân: mỗi ảnh là một lượt chat (đánh thức, đọc ảnh, tra dữ liệu, ghi file), không thể nhanh như tool chạy trên máy.
- Đã sửa thế nào: thêm `scripts/ocr-live.ps1` (OCR Windows, ~0,8 giây, tự chạy liên tục); chế độ Claude giữ lại để hỏi sâu.
- Lần sau tránh bằng cách: việc cần kết quả trong vài giây khi đang chơi thì làm bằng script chạy trên máy; Claude chỉ dùng cho câu hỏi chờ được.

## 4. Đọc màn hình

### OCR Windows bỏ sót số đứng riêng
- Ngày: 20/11/2026
- Chuyện gì xảy ra: vàng "2", máu "68", "50" đọc ra rỗng; vòng "1-3" đôi khi rỗng.
- Nguyên nhân: OCR của Windows hay bỏ qua chuỗi số ngắn đứng một mình trên nền nhiều chi tiết.
- Đã sửa thế nào: `Read-Number` trong `scripts/ocr-live.ps1`: đổi vùng sang đen trắng (ColorMatrix + SetThreshold), chừa lề, viết chữ mồi "Gold" bên trái rồi mới đọc; thử vài ngưỡng; sửa chữ hay nhầm (o→0, s→5).
- Lần sau tránh bằng cách: vùng chỉ có số thì đọc qua `Read-Number`. Chỉnh vùng bằng `-Image <ảnh> -Dump`, thử trên đủ ảnh đầu / giữa / cuối trận.
