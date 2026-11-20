# TFT Helper

Tool hỗ trợ chơi Teamfight Tactics Set 19 (Prismatic Tour). Gồm hai phần:

1. **Web tra cứu**: dùng online tại **https://khuongnguyen2908.github.io/FlyntTFTHelper/**, hoặc mở trên máy (`web/index.html`).
2. **Claude tư vấn trong chat**: dán ảnh chụp game vào chat Claude ở thư mục này để được khuyên theo tình huống.

## Mở web

Bấm đúp vào `web/index.html` (mở bằng Chrome / Edge). Không cần cài gì thêm.
Ảnh tướng / đồ được tải từ MetaTFT, nên máy cần có mạng.

Giao diện tối kiểu TFT, hợp nhất khi mở trên màn hình thứ 2. Rê chuột lên tướng / đồ / tộc hệ / lõi để xem nhanh; bấm vào để mở chi tiết ở ngăn bên phải (Esc để đóng).

Các tab:
- **🎯 Tình huống**: chia 2 cột.
  - Cột trái nhập: Vòng / Cấp / Vàng / Máu bằng nút − / + (lăn chuột cũng được, Shift = ×5); Bàn của tôi; Nhà khác tranh; mảnh trang bị (trái thêm, phải bớt); lõi đang có; bảng chọn tướng.
  - Chọn tướng: **bấm trái** = thêm vào Bàn của tôi, **bấm phải** = thêm vào **nhà khác đang chọn**. Hoặc bấm `/`, gõ vài chữ tên rồi **Enter** (Shift+Enter = vào nhà đang chọn). Bấm tướng ở Bàn của tôi để bỏ.
  - **Nhà khác** (7 nhà): bấm vào hàng hoặc **phím 1–7** để chọn nhà, rồi bấm phải vào tướng. Bấm đúp tên để đổi tên. Tool tự đoán đội của từng nhà (≈ tên đội); tướng bị nhiều nhà giữ có số đỏ trên ảnh.
  - Cột phải: gợi ý đội hợp nhất (thanh % khớp). Bấm **🎯 Nhắm** để xem kế hoạch: mức khớp, **🪜 lộ trình theo cấp**, việc cần làm, mua / bán (kèm điều kiện mở khoá), đồ cần cho chủ lực (ghép ngay / thiếu mảnh nào), lõi hợp tộc hệ.
  - **🏟 Sảnh đấu** (khi đã đánh dấu tướng nhà khác): đội bạn nhắm bị sảnh này làm hạng tệ / tốt đi bao nhiêu (số liệu khắc chế của MetaTFT), hạng dự kiến, từng nhà đang chơi gì và tranh tướng nào, và gợi ý đội hợp sảnh nhất. Danh sách đội hợp nhất cũng tính ảnh hưởng của sảnh.
  - **📍 Xếp vị trí**: bàn lục giác 4 hàng × 7 ô trong thẻ Lộ trình theo cấp, theo cấp đang xem (nút "Xem bàn đủ đội"). Ngăn chi tiết đội có bàn xếp vị trí và mục **⚔ Khắc chế** (mạnh / yếu khi gặp, hay bị tranh tướng với).
  - **🪜 Lộ trình theo cấp**: bàn cờ nên đặt ở cấp 4 → 10 của đội đang nhắm (số liệu MetaTFT), tự chọn đúng cấp bạn đang ở, đánh dấu tướng có / thiếu, vòng thường lên cấp đó, 1 bàn chính + 2 bàn thay thế, nút 📋 copy mã từng bàn. Ngăn chi tiết đội cũng có đủ các cấp.
  - **🔔 Nhắc việc** (đầu cột phải, viền đỏ khi có việc cần làm ngay):
    - Mở khoá tướng của đội đang nhắm (kể cả tướng trong lộ trình theo cấp): điều kiện (tiếng Anh), cấp tối thiểu, và tiến độ tự kiểm tra được từ bàn của bạn (vd đủ Ziggs 2★ → "nhớ cho Ziggs cầm 1 đồ!"; Seraphine phải làm trước vòng 2-4). Nút **✓ Đã mở khoá** ẩn lời nhắc và bỏ 🔒.
    - Lõi nhiệm vụ đang có: Prismatic Tour của Ionic Spark / Heartsteel / Pentakill / True Damage / K/DA (kiểm tra số tướng tộc hệ, vd "đang có 5/7 Ionic Spark — chưa nhận chữ ký album!"), Ngàn Nhát Cắt, Quản Lý Cổ Đông, Nhiệm Vụ Trang Bị, Nhà Máy Tái Chế, Vượt Thời Gian, Trứng Vàng; lõi có thưởng theo thời gian thì nhắc nhẹ kèm vòng lấy lõi. Nút **✓ Đã xong** để ẩn.
  - Nút **🆕 Ván mới** (cạnh Vòng / Cấp / Vàng / Máu): xoá hết để bắt đầu ván khác.
  - Các lựa chọn được nhớ lại cho lần mở sau.
- **🏆 Đội hình mạnh**: đội hình từ số liệu MetaTFT (bậc S–D theo hạng trung bình), đồ chủ lực, lối chơi (reroll / lên nhanh).
- **📋 Copy mã**: có ở mỗi đội hình, ở khung Đội đang nhắm, và nút "Copy mã" của Bàn của tôi. Vào game: Team Planner → Import → dán. Một số tướng PBE chưa có mã đúng (hiện là Graves, Mordekaiser, Nasus) sẽ bị bỏ qua và tool có báo.
- **🧙 Tướng**: lọc theo giá / tộc hệ; kỹ năng, chỉ số, điều kiện mở khoá, đồ hay lên, lên đồ từ mảnh đang có.
- **🔷 Tộc hệ**, **⚔️ Trang bị** (bảng ghép đồ), **✨ Lõi**, **💡 Mẹo** (có danh sách phím tắt).

Sau khi cập nhật tool, nhấn **Ctrl+F5** nếu trang vẫn hiện giao diện cũ.

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

## Bản online (GitHub Pages)

Workflow `.github/workflows/pages.yml` tự đưa thư mục `web/` lên GitHub Pages:
- mỗi lần push lên nhánh `main`;
- mỗi ngày lúc 10:00 (giờ Việt Nam), kèm tải dữ liệu MetaTFT mới;
- hoặc bấm tay: tab **Actions** → **Deploy TFT Helper** → **Run workflow**.

Nếu không tải được dữ liệu mới (MetaTFT lỗi, hoặc đội hình không đúng Set), bản online giữ dữ liệu có sẵn trong repo.
Lưu ý: GitHub tự tắt lịch chạy hằng ngày nếu repo không có hoạt động trong 60 ngày.

## Lưu ý

- Dữ liệu lấy qua đường dẫn công khai của MetaTFT, không phải API chính thức. Nếu MetaTFT đổi cấu trúc thì script có thể lỗi.
- Ở PBE số trận còn ít, nên bậc đội hình chỉ để tham khảo. Lõi chưa có số liệu tỉ lệ thắng.
- Một số mô tả còn tiếng Anh vì bản tiếng Việt của dữ liệu chưa dịch đủ.
