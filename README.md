# TFT Helper

Tool hỗ trợ chơi Teamfight Tactics Set 19 (Prismatic Tour). Gồm hai phần:

1. **Web tra cứu** chạy trên máy (`web/index.html`).
2. **Claude tư vấn trong chat**: dán ảnh chụp game vào chat Claude ở thư mục này để được khuyên theo tình huống.

## Mở web

Bấm đúp vào `web/index.html` (mở bằng Chrome / Edge). Không cần cài gì thêm.
Ảnh tướng / đồ được tải từ MetaTFT, nên máy cần có mạng.

Các tab:
- **Tình huống của tôi**: chọn tướng đang có, tướng nhà khác đang tranh, mảnh trang bị (bấm để thêm, chuột phải để bớt), lõi, vòng / cấp / vàng / máu.
  Tool gợi ý đội hợp nhất, bước tiếp theo, cách ghép đồ và tướng nên bán. Các lựa chọn được nhớ lại cho lần mở sau.
  - Bấm **Nhắm đội này** (ở đây hoặc ở tab Đội hình mạnh): khung **Đội đang nhắm** hiện trên cùng, gồm mức khớp với bàn của bạn (Hợp / Tạm được / Chưa hợp), việc nên làm, tướng mua theo thứ tự (kèm điều kiện mở khoá), tướng có thể bán, đồ cần cho từng chủ lực (ghép được ngay / thiếu mảnh nào) và lõi hợp tộc hệ của đội.
- **Đội hình mạnh**: đội hình từ số liệu MetaTFT (bậc S–D theo hạng trung bình), đồ chủ lực, lối chơi (reroll / lên nhanh).
- **📋 Copy mã**: có ở mỗi đội hình, ở khung Đội đang nhắm, và nút "Copy mã bàn của tôi". Vào game: Team Planner → Import → dán. Một số tướng PBE chưa có mã đúng (hiện là Graves, Mordekaiser, Nasus) sẽ bị bỏ qua và tool có báo.
- **Tướng**: kỹ năng, chỉ số, điều kiện mở khoá, đồ hay lên, lên đồ từ mảnh đang có.
- **Tộc hệ**, **Trang bị** (bảng ghép đồ), **Lõi**, **Mẹo nhanh**.

## Hỏi Claude khi đang chơi

Bấm `Win+Shift+S`, chụp màn hình game, dán vào chat Claude ở thư mục dự án này, rồi hỏi, ví dụ:
- "nên roll hay lên cấp?"
- "chọn lõi nào trong 3 cái này?"
- "Jinx nên lên đồ gì với mấy mảnh này?"

Muốn Claude kiểm tra nhà khác: chụp thêm bàn của từng nhà.

## Cập nhật dữ liệu

```
node scripts/update-data.mjs
```

Script tải tướng, tộc hệ, trang bị, lõi (tiếng Việt + Anh) và đội hình PBE từ MetaTFT, rồi ghi vào `data/set19/` và `web/data.js`.
Khi Set 19 lên bản chính thức (khoảng 1/12), lấy đội hình rank bản chính thức bằng:

```
node scripts/update-data.mjs --queue 1100
```

Cần Node.js 18 trở lên.

## Lưu ý

- Dữ liệu lấy qua đường dẫn công khai của MetaTFT, không phải API chính thức. Nếu MetaTFT đổi cấu trúc thì script có thể lỗi.
- Ở PBE số trận còn ít, nên bậc đội hình chỉ để tham khảo. Lõi chưa có số liệu tỉ lệ thắng.
- Một số mô tả còn tiếng Anh vì bản tiếng Việt của dữ liệu chưa dịch đủ.
