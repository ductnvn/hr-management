# 🏭 Ứng dụng Quản lý Nhân sự nội bộ

Ứng dụng web quản lý cơ sở dữ liệu nhân sự cho công ty sản xuất. **Không cần cài đặt gói phụ thuộc** — chỉ cần Node.js ≥ 22.5 (dùng SQLite tích hợp sẵn `node:sqlite`).

## Chạy ứng dụng

```bash
node server.js
```

Mở trình duyệt: <http://localhost:3000>

- **Mật khẩu quản trị mặc định:** `admin123`
- Đổi mật khẩu / cổng bằng biến môi trường:

```bash
ADMIN_PASSWORD='matkhau-manh' PORT=8080 node server.js
```

Dữ liệu lưu trong file `hr.db` (SQLite) cùng thư mục — sao lưu chỉ cần copy file này.

## 🚀 Deploy lên internet (chạy trực tiếp)

App là **server Node + database SQLite (file)**, nên hãy dùng host chạy tiến trình liên tục có **đĩa lưu bền** (KHÔNG dùng Vercel/Netlify serverless vì sẽ mất dữ liệu). Đề xuất **Render** hoặc **Railway** — đều có gói miễn phí và deploy thẳng từ GitHub.

### Cách A — Render (có sẵn blueprint)
1. Đẩy repo này lên GitHub (xem cuối file).
2. Vào [render.com](https://render.com) → **New → Blueprint** → chọn repo. File [`render.yaml`](render.yaml) đã cấu hình sẵn: chạy `node --experimental-sqlite server.js`, gắn **đĩa lưu 1GB** tại `/data` và đặt `HR_DB=/data/hr.db` để dữ liệu **không bị mất** khi deploy lại.
3. Ở mục Environment, đặt `ADMIN_PASSWORD` = mật khẩu mạnh của bạn.
4. Bấm Deploy → mở URL Render cấp.

### Cách B — Railway
1. Vào [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → chọn repo.
2. Railway tự nhận Node và chạy `npm start`. Thêm biến `ADMIN_PASSWORD`.
3. **Quan trọng để giữ dữ liệu:** Add a **Volume**, mount vào (vd) `/data`, rồi đặt biến `HR_DB=/data/hr.db`. Không có volume, dữ liệu sẽ mất mỗi lần redeploy.

> Ghi chú: app pin Node 22 (`.node-version`) và bật `node:sqlite` qua cờ `--experimental-sqlite`. `PORT` do host tự cấp, app tự đọc.

## Tính năng

### 1. Quản lý hồ sơ nhân sự
- Thêm / sửa / xóa nhân sự, tìm kiếm theo mã, tên, SĐT, bộ phận.
- **Bộ trường đã hiệu chỉnh khớp file dữ liệu thực tế của công ty**, chia 7 nhóm: Cá nhân · Học vấn · Địa chỉ & Liên hệ · Công việc · Hợp đồng lao động · Lương & Bảo hiểm · Khác. Gồm Mã số, Vị trí/Chức danh, Job Description, Level, Nhóm lương, Quản lý trực tiếp/Trưởng bộ phận, Nơi sinh, Khu vực, Loại hình tuyển dụng, hệ thống HĐ thử việc + HĐ lần 1/2/3, Xã–Tỉnh–địa chỉ đầy đủ… và giữ Tên trường học / Tên ngành học cùng các trường mở rộng (CCCD, MST, BHXH, BHYT, ngân hàng…).
- Ô **Tên trường học** chọn từ danh sách ~178 trường ĐH/CĐ Việt Nam (gõ để tìm, vẫn nhập tự do được).
- Xuất danh sách ra CSV (mở được bằng Excel, đúng font tiếng Việt).

### 📥 Nhập từ Excel / CSV
- Nút **Nhập Excel** trong danh sách nhân sự → chọn tệp `.xlsx` hoặc `.csv`.
- Hệ thống tự đọc tệp (tự viết bộ đọc `.xlsx` bằng `node:zlib`, **không cần cài thư viện**), tự nhận dòng tiêu đề và **tự động ghép cột** theo tên cột của file công ty (Maso, Hoten, Phongban…) hoặc theo nhãn trường. Ngày tháng trong Excel được đổi sang `YYYY-MM-DD`.
- Cho phép chỉnh tay việc ghép cột trước khi nhập. Khi nhập: **trùng Mã số thì cập nhật, còn lại thêm mới** (không tạo bản ghi trùng).
- Bí danh cột & logic ghép nằm trong [admin.js](public/admin.js) (`IMPORT_ALIASES`), bộ đọc tệp ở [xlsx.js](xlsx.js).

### 🎓 Quản lý Thực tập sinh
- Tab **Thực tập sinh** riêng: danh sách ứng viên (thêm/sửa/xóa, tìm kiếm, xuất CSV), theo dõi trạng thái (Mới nộp → Xem xét → Phỏng vấn → Nhận/Từ chối).
- **Link ứng tuyển công khai** (`/apply`) để gửi cho ứng viên: họ điền 9 thông tin (họ tên, SĐT, email, trường ĐH/CĐ, chuyên ngành, năm học, vị trí ứng tuyển, thời gian bắt đầu/kết thúc dự kiến) và gửi — hồ sơ **tự động vào database thực tập sinh**. Trường học/chuyên ngành có gợi ý sẵn, form song ngữ.

### 🌐 Song ngữ Việt – Anh
- Nút chuyển ngôn ngữ ở góc dưới thanh bên (và góc trên trang tự cập nhật). Toàn bộ giao diện + nhãn trường chuyển giữa **Tiếng Việt** và **English**, ghi nhớ lựa chọn theo trình duyệt.
- Chỉnh nhãn/thuật ngữ trong [i18n.js](public/i18n.js); nhãn trường Anh–Việt nằm ngay trong [fields.js](fields.js) (`label` / `label_en`).

### 2. Gửi link cho nhân sự tự cập nhật (đồng loạt)
- Trong mục **"Cập nhật từ xa"**, tạo một *yêu cầu cập nhật*: chọn đúng những trường bạn muốn nhân sự tự sửa (VD: SĐT, email, số tài khoản), đặt hạn (tùy chọn).
- Hệ thống sinh **một liên kết** — gửi cho toàn bộ nhân sự qua Zalo/email.
- Nhân sự mở link → xác thực bằng **Mã NV + Ngày sinh** → chỉ sửa được đúng các trường được cho phép → lưu.
- Mọi thay đổi được ghi lại ở mục **"Lịch sử cập nhật"** (trường nào, từ giá trị gì → giá trị gì).
- An toàn: server chỉ chấp nhận đúng các trường trong danh sách cho phép — nhân sự không thể sửa lương, chức danh… dù cố tình.

## Tùy biến trường thông tin

Sửa file [`fields.js`](fields.js) để thêm/bớt/đổi trường. Bảng dữ liệu tự cập nhật cột theo định nghĩa này (cột mới sẽ được tạo khi khởi động lại; xóa `hr.db` nếu muốn tạo lại từ đầu).

## Cấu trúc dự án

```
server.js     Máy chủ HTTP + API (thuần Node, không framework)
db.js         Truy cập SQLite + dữ liệu mẫu
fields.js     Định nghĩa toàn bộ trường nhân sự (nguồn sự thật duy nhất)
public/       Giao diện: admin (index/admin.js) + cổng tự cập nhật (update)
```
