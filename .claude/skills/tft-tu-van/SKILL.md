---
name: tft-tu-van
description: Tư vấn khi chơi Teamfight Tactics (TFT) Set 19. Dùng khi người dùng dán ảnh chụp màn hình trận TFT, hoặc hỏi nên roll / lên cấp / giữ vàng, mua bán tướng nào, chơi đội hình nào, lên đồ gì từ mảnh đang có, chọn lõi (augment) nào, nhà khác đang chơi gì / tranh tướng nào, hay bất cứ câu hỏi nào về tướng, tộc hệ, trang bị, lõi TFT.
---

# Tư vấn TFT

Việc này **chỉ đọc**: trả lời luôn, không cần chờ đồng ý. Người dùng chơi nhiều và hiểu cơ chế, nên trả lời **ngắn, đi thẳng vào việc cần làm**.
Không giải thích kiến thức cơ bản trừ khi được hỏi. Trả lời bằng tiếng Việt, tên tướng / đồ / lõi dùng tên tiếng Việt như trong game kèm tên tiếng Anh khi dễ nhầm.

## Dữ liệu (đọc trước khi khuyên)

Tất cả ở `data/set19/` (tạo bởi `scripts/update-data.mjs`, nguồn MetaTFT):

| File | Có gì |
|---|---|
| `meta.json` | Set, bản (pbe/live), thời điểm tải (`fetchedAt`), số trận của bảng đội hình |
| `units.json` | Tướng: `name` (Việt), `nameEn`, `cost`, `traits` (id), `role`, `stats`, `ability.desc` (số a/b/c = 1★/2★/3★), `unlock` (điều kiện mở khoá, null = có sẵn trong shop) |
| `traits.json` | Tộc hệ: `name`, `type` (origin/class/unique), `steps` (mốc kích + hiệu ứng), `units` |
| `items.json` | Trang bị: `kind` (component/craftable/emblem/artifact/radiant/support/other), `from` (2 mảnh), `desc` |
| `augments.json` | Lõi: `rarity` (Silver/Gold/Prismatic), `tags`, `traits` liên quan, `desc` |
| `comps.json` | Đội hình mạnh: `units`, `carries`, `builds` (đồ của chủ lực + hạng TB), `avg` (hạng trung bình, thấp = tốt), `count`, `tier` S–D, `levelling` (lvl 5/6/7 = reroll; Standard; Fast 8/9), `extraUnits`, `path` (lộ trình theo cấp: `path["5"] = { stage: "3-2", boards: [{units, avg, win, count}, ...] }`, phần tử đầu là bàn chính) |
| `unitItems.json` | Theo từng tướng: đồ hay lên nhất (`items` có `avg`) và bộ 3 món tốt (`builds`) |

- Tìm bằng Grep theo tên (Việt hoặc Anh) hay id, **không đọc nguyên file lớn**. Ví dụ: Grep `"nameEn": "Jinx"` trong `data/set19/units.json` với vài dòng sau.
- Mở đầu mỗi lần tư vấn: xem `meta.json`. Nếu `fetchedAt` cũ hơn 3 ngày, cuối câu trả lời nhắc một dòng: "Dữ liệu đã cũ X ngày, nói *cập nhật dữ liệu* để tải lại."
- Số liệu PBE: ít trận, đổi nhanh, nên coi bậc S–D là tham khảo. Đội có `tier: "?"` là chưa đủ trận.
- Không bịa cơ chế, số liệu. Chưa có trong dữ liệu và không chắc thì nói "chưa rõ".

## Đọc ảnh chụp màn hình

Đọc lần lượt, ghi lại những gì thấy được:
1. **Vòng** (vd 3-2, góc trên), **vàng**, **cấp + XP**, **máu** và thứ hạng (danh sách người chơi bên phải), **chuỗi thắng / thua**.
2. **Cửa hàng** (5 tướng dưới cùng), **hàng chờ**, **bàn cờ** (tướng + số sao + đồ đang cầm).
3. **Mảnh / đồ trong kho** (bên trái), **lõi đã chọn** (biểu tượng bên trái hoặc khi rê chuột), **lựa chọn lõi** nếu đang chọn.
4. **Tộc hệ đang kích** (cột bên trái).
5. Ảnh bàn nhà khác: tướng chủ lực, tộc hệ chính, đồ, cấp của từng nhà.

Chỗ nào mờ / bị che / không chắc: ghi vào mục **Chưa chắc**, đừng đoán. Cần thì xin người dùng chụp lại phần đó.

## Cách suy nghĩ

- **Đội hình:** so tướng + đồ đang có với `comps.json`. Ưu tiên đội (1) có sẵn chủ lực hoặc nhiều tướng, (2) mảnh đồ đang có ghép được đồ chủ lực, (3) ít nhà khác tranh, (4) `avg` tốt. Giữa 2 đội ngang nhau, chọn đội linh hoạt hơn ở thời điểm hiện tại.
- **Bàn theo cấp:** khi khuyên nên đặt tướng gì ở cấp hiện tại, lấy `path[cấp].boards[0]` của đội đang nhắm, so với tướng người dùng có; thiếu tướng thì xem 2 bàn thay thế.
- **Tướng bị tranh:** đếm số nhà đang giữ cùng tướng chủ lực / cùng tộc hệ chính. Hai nhà trở lên chơi cùng đội reroll thì nên đổi hướng.
- **Mở khoá (Set 19):** tướng có `unlock` chỉ ra shop khi đạt điều kiện. Đừng khuyên đi đội cần tướng chưa mở khoá trừ khi điều kiện dễ đạt, và nói rõ điều kiện.
- **Lên cấp / roll:** mốc chuẩn 2-1 cấp 4, 2-5 cấp 5, 3-2 cấp 6, 3-5/4-1 cấp 7, 4-2 cấp 8, 5-1 cấp 9 (tuỳ đội). Đội reroll thì giữ cấp và roll phần vàng trên 50 tới khi chủ lực 3★. Đội lên nhanh thì giữ 50 vàng, roll mạnh ở cấp 8 / 9. Máu ≤ 30–40 thì ưu tiên mạnh ngay.
- **Đồ:** lấy đồ chủ lực từ `builds` của đội đang nhắm, hoặc `unitItems` của tướng. Chọn cách ghép dùng được nhiều mảnh nhất cho chủ lực ưu tiên. Đồ tank đưa cho tank chính. Nên ghép sớm để giữ máu thay vì ôm mảnh. Nhắc mảnh nào nên giữ chờ món chuẩn.
- **Lõi:** chưa có số liệu tỉ lệ thắng của lõi Set 19 (PBE). Đánh giá theo: hợp đội đang nhắm (traits, đồ, kinh tế) > sức mạnh ngay > linh hoạt. Nói rõ đây là nhận định, không phải số liệu.

## Mẫu trả lời

Ngắn gọn, mỗi mục 1–3 dòng, bỏ mục không liên quan:

```
**Tình hình:** 3-2 · cấp 5 · 32 vàng · 78 máu · thua 2 trận liền
**Làm ngay:** mua Ziggs, Lulu; bán Garen; roll tới 30 vàng tìm Kobuko 2★ rồi dừng
**Hướng đội:** Hyperpop + Kobuko (reroll cấp 5, hạng TB 3.03): có sẵn 4/9 tướng, chủ lực Kobuko. Dự phòng: …
**Đồ:** ghép ngay Cuồng Đao (Cung + Gậy) cho Ziggs; giữ Đai + Giáp chờ Thạch Giáp cho Kobuko
**Lõi:** chọn A > B > C. A vì …
**Nhà khác:** nhà 3 và nhà 6 cùng giữ Kobuko, nên cân nhắc đổi sang …
**Chưa chắc:** không đọc rõ đồ trên Lux
```

Nếu người dùng chỉ hỏi một câu (vd "Jinx lên đồ gì?"), trả lời đúng câu đó, có số liệu từ dữ liệu, không dùng cả mẫu.

## Web tra cứu

Người dùng có thể mở `web/index.html` để tự tra cứu. Khi hợp, gợi ý tab liên quan (Tình huống của tôi / Đội hình mạnh / Tướng / Trang bị / Lõi).
