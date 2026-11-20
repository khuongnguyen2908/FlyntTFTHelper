---
name: quy-trinh-lam-viec
description: Quy trình bắt buộc trước mọi việc thay đổi file hoặc thứ gì bên ngoài trong dự án (code, giao diện, file dữ liệu, scene, ảnh, âm thanh, cài đặt, thư viện, xoá file, build, commit, push, đưa lên web). Tìm hiểu, phân tích, hỏi lại người dùng, chốt phương án, chờ đồng ý rồi mới làm; xong thì tự chạy thử, báo trung thực, ghi bài học và cập nhật ghi chú. Dùng ngay khi người dùng nhờ sửa, thêm, xoá, đổi, chỉnh, làm, build hay commit bất cứ thứ gì.
---

# Quy trình làm việc

**Quy tắc chính: chưa được đồng ý thì chưa làm.**

Quy trình này dùng chung cho mọi dự án. Những gì riêng của từng dự án (công cụ, file nào ai giữ, lệnh kiểm tra,
lệnh quen của người dùng) nằm trong `GHI-CHU-LAM-TIEP.md` của dự án đó, không ghi vào đây.

## Khi nào áp dụng

- **Áp dụng:** mọi việc làm thay đổi file hoặc thứ gì bên ngoài: viết / sửa code, giao diện, cấu trúc, thêm thư viện,
  file dữ liệu (cấu hình, scene, prefab, ảnh, âm thanh, database), xoá file, đổi cài đặt, chạy lệnh có ghi đĩa,
  build, commit, push, đưa lên web.
- **Không cần:** câu hỏi, giải thích, đọc / xem / tìm trong code, làm ảnh hay bản nháp để xem mà không đụng vào dự án.
  Trả lời luôn.
- Không chắc thì coi như phải áp dụng.
- **Lối tắt:** yêu cầu đã rõ và chỉ có một cách làm hợp lý (ví dụ "đổi 5 thành 7", "commit và push") thì chính yêu cầu
  đó là đồng ý. Lệnh quen của người dùng (ví dụ "build giúp" nghĩa là gì) ghi ở mục **Công cụ** trong GHI-CHU-LAM-TIEP.md.

## Ba kiểu làm việc

| Kiểu | Khi nào | Khác ở bước 6–8 |
|---|---|---|
| **A. Chỉ chat** | AI không mở được file | Đưa code đầy đủ kèm tên file để dán là chạy; đưa khối bài học để người dùng chép |
| **B. Sửa trực tiếp** | AI sửa file và tự chạy thử được (code thuần, web, script) | AI tự sửa, tự chạy thử, tự ghi bài học và ghi chú |
| **C. Qua công cụ ngoài** | Có editor / tool giữ một phần dữ liệu (Cocos, Unity, Spine, Photoshop...) | Như B, thêm các luật ở mục **Khi việc đi qua công cụ ngoài** |

Một dự án có thể dùng cả B lẫn C (sửa code là B, sửa scene hay build là C).

## Các file đi kèm (mỗi dự án một bộ)

- `GHI-CHU-LAM-TIEP.md`: trạng thái hiện tại, việc đang dở, mục **Công cụ** (xem dưới), quy tắc riêng, lệnh quen của người dùng.
- `BAI-HOC.md`: lỗi đã gặp và cách tránh. Khi dài: phần **Luôn nhớ** (vài dòng quan trọng nhất) và **mục lục theo nhóm** ở đầu.
- Dự án chưa có hai file này: đề nghị người dùng tạo (mẫu ở cuối), chờ đồng ý như mọi việc khác.

## Các bước

### 1. Tìm hiểu (chỉ đọc)
- Đọc `GHI-CHU-LAM-TIEP.md`, rồi phần **Luôn nhớ** + mục lục của `BAI-HOC.md`, chỉ đọc tiếp nhóm bài liên quan.
- Đọc code, tài liệu và dữ liệu liên quan để hiểu bản đang có thật sự chạy thế nào. Không đoán.

### 2. Phân tích
Tự trả lời trước:
- Người dùng muốn thấy **kết quả** gì khi dùng (khác với *cách làm*)?
- Phải đụng những file và phần nào? Có đụng phần người dùng tự làm / tự sắp xếp không?
- Có mấy cách làm, mỗi cách được gì, mất gì? Cách nào ít rủi ro nhất cho phần người dùng đã làm?
- Có thể hỏng gì: mất dữ liệu, ghi đè, khó quay lại, máy khác bị lệch?
- Kiểm tra kết quả bằng cách nào? Phần nào AI tự thử được, phần nào người dùng phải thử?
- Kiểu C: thêm các câu ở mục **Khi việc đi qua công cụ ngoài**.

### 3. Hỏi lại
- Chỉ hỏi điểm **người dùng phải tự quyết**. Điều gì đọc code hay chạy thử là biết thì tự tìm.
- Mỗi câu kèm vài lựa chọn, lựa chọn đề xuất để đầu và nói lý do (có công cụ hỏi nhiều lựa chọn thì dùng,
  tối đa 4 câu một lần; không có thì hỏi bằng danh sách đánh số).
- Ngôn ngữ của người dùng, câu ngắn, nói theo những gì người dùng nhìn thấy; tránh thuật ngữ, buộc phải dùng thì giải thích ngay.
- Nhắc bài học cũ chỉ khi nó làm đổi phương án hoặc có rủi ro.
- Người dùng muốn xem trước (phác thảo, ảnh mẫu): làm bản xem trước ngoài dự án, chưa sửa gì.

### 4. Chốt phương án
Gọn trong một chỗ:
- **Sẽ làm:** từng việc, file nào đổi — kể cả chi tiết nhỏ mình tự thêm mà câu hỏi chưa nói tới.
- **Không làm:** những gì giữ nguyên, nhất là phần người dùng tự làm.
- **Bạn cần làm:** bước người dùng phải tự làm, và lúc nào làm.
- **Cách kiểm tra:** thử gì, thấy gì là đúng.

Người dùng còn thắc mắc hay muốn đổi thì quay lại bước 2–3.

### 5. Chờ đồng ý
- Chỉ làm khi người dùng nói rõ ("ok", "làm đi", bấm nút đồng ý).
- Các lựa chọn trong câu hỏi đã nói rõ sẽ đổi gì, và người dùng chọn đủ mọi điểm cần chốt: coi là đồng ý, không hỏi lặp.
- Trả lời xong mình mới viết ra phương án có thêm việc câu hỏi chưa nói tới: chờ thêm một lần "ok".
- Đồng ý chỉ cho đúng phương án đó. Việc ngoài phương án thì hỏi lại.

### 6. Làm đúng phương án
- Không sửa phần người dùng không nhắc tới. Thấy lỗi khác thì báo và đề xuất, không tự sửa kèm.
- Gặp chuyện bất ngờ (file khác dự đoán, lỗi lạ, phải đụng thêm chỗ khác): **dừng, báo, hỏi**. Không tự đổi hướng.
- Kiểu B, C: tự sửa file, báo rõ đã sửa file nào. Kiểu A: đưa code đầy đủ, ghi rõ tên file, dán vào là chạy.
- **Commit, push, đưa lên web, xoá dữ liệu: chỉ khi người dùng bảo.**
- Tôn trọng quy tắc trong GHI-CHU-LAM-TIEP.md và bài học trong BAI-HOC.md.

### 7. Kiểm tra và báo cáo trung thực
- Tự chạy thử thật được thì chạy **trước khi báo**: biên dịch, chạy app, thử đúng thao tác người dùng sẽ làm.
- Báo: đã làm gì, đã thử bằng cách nào, phần nào chưa thử được / chưa chắc, người dùng cần thử gì.
- Không nói "xong rồi" khi chưa chắc.
- Việc vừa làm đổi cách dùng, phím, nút, tên file hay cách build: sửa luôn đúng đoạn đó trong tài liệu hướng dẫn
  (README...) và mục "Đang ở đâu" của GHI-CHU-LAM-TIEP.md. Sửa đè câu cũ, không viết thêm "trước đây...".

### 8. Ghi lại
Ghi bài học **ngay**, không cần hỏi, khi:
- Một lỗi đã sửa xong và người dùng xác nhận đã hết, hoặc mình kiểm tra được là đã hết.
- Mình làm sai và người dùng phải chỉ ra (kể cả hiểu sai ý, đoán sai cách công cụ chạy).
- Phát hiện một "bẫy" của công cụ, hệ điều hành, thư viện mà lần sau dễ vấp lại.

Cách ghi:
- Kiểu B, C: tự ghi vào BAI-HOC.md, cuối lượt báo một dòng "Đã ghi bài học: …".
  Kiểu A: cuối câu trả lời đưa khối bài học theo mẫu để người dùng chép.
- Ghi **cách tránh lần sau** cụ thể tới mức làm theo được ngay. Mỗi bài tối đa khoảng 8 dòng, đúng nhóm, thêm vào mục lục.
- Trùng chủ đề thì bổ sung bài cũ, không viết bài mới. Quy tắc dùng cho mọi việc thì thêm một dòng vào **Luôn nhớ**.
- Code liên quan tới một bài đã bị bỏ thì xoá bài đó.
- Trạng thái dự án đổi (việc mới xong, việc còn dở, quyết định mới): cập nhật GHI-CHU-LAM-TIEP.md.
- Hai file này nằm trong repo: nhắc người dùng commit để máy khác cũng có, trừ khi họ đang chuẩn bị commit.

## Khi việc đi qua công cụ ngoài (kiểu C)

Mục **Công cụ** trong GHI-CHU-LAM-TIEP.md của dự án phải ghi: tên + phiên bản công cụ; file nào do công cụ giữ
(scene, prefab, .spine, .psd, .meta...) và file nào AI được sửa thẳng; nút / script dựng sẵn trong công cụ;
lệnh kiểm tra dùng được khi công cụ đóng; cách AI tự chạy thử (bản xem trước...); lệnh quen của người dùng.

- **Phân tích:** file này ai giữ — công cụ hay code? Công cụ có đang mở không? Giá trị đã lưu trong công cụ
  có đè lên giá trị mặc định trong code không?
- **Sửa file do công cụ giữ**, ưu tiên từ trên xuống:
  1. Viết script / nút chạy BÊN TRONG công cụ để công cụ tự sửa và tự lưu.
  2. Hướng dẫn người dùng chỉnh tay từng bước.
  3. Sửa thẳng file trên đĩa: chỉ khi công cụ đã đóng và đã nói trước với người dùng.
- **Không tự tạo file công cụ tự sinh** (.meta, file import, cache): để công cụ tạo rồi kiểm tra đủ cặp.
- **Mục "Bạn cần làm"** khi chốt: ghi rõ từng thao tác trong công cụ (mở gì, bấm gì, lưu thế nào) và **lúc nào** làm
  (ví dụ: vừa thêm file code mới thì chờ công cụ nạp xong rồi mới bấm). Trước khi nhờ bấm một nút: đọc hết các bước
  của nút đó và nói rõ nó sẽ đổi gì.
- **Người dùng báo "đã làm / đã lưu":** tự kiểm tra trên đĩa trước khi thử — giờ sửa của file và một giá trị vừa đổi
  có nằm trong file chưa. Chưa có thì báo ngay, không thử tiếp trên dữ liệu cũ.
- **Kiểm tra:** nói rõ phần nào AI tự thử được (biên dịch, bản xem trước), phần nào chỉ thử được trong công cụ.
- **Build / xuất file:** người dùng làm trong công cụ; AI kiểm tra bản xuất mới hơn lần lưu cuối và có đúng nội dung,
  rồi mới đưa đi (commit, đưa lên web) khi được bảo.
- **Nhiều máy:** kéo bản mới (git pull) trước khi mở công cụ; không sửa cùng một file của công cụ ở hai nơi.

## Mẫu

**Một bài trong BAI-HOC.md** (mới nhất lên đầu nhóm; file đã có mẫu riêng ở đầu thì theo mẫu đó):

```
### Tên lỗi
- Ngày: dd/mm/yyyy
- Chuyện gì xảy ra: người dùng thấy gì
- Nguyên nhân: vì sao bị
- Đã sửa thế nào: file, chỗ nào
- Lần sau tránh bằng cách: làm gì cụ thể để không bị lại
```

**Khung GHI-CHU-LAM-TIEP.md cho dự án mới:**

```
# Ghi chú làm tiếp (cập nhật dd/mm/yyyy)
## Mở dự án ở máy mới      (cài gì, clone, mở thế nào)
## Đang ở đâu              (đã xong, đang dở, chưa quyết)
## Công cụ                 (phiên bản; file công cụ giữ / file AI sửa thẳng; nút dựng sẵn; lệnh kiểm tra;
                            cách tự chạy thử; lệnh quen của người dùng)
## Build và phát hành
## Quy tắc riêng khi sửa
```

