// Danh sách ngành học phổ biến tại Việt Nam (dùng cho ô chọn "Tên ngành học").
// Cho phép gõ để lọc và vẫn nhập tự do nếu ngành không có trong danh sách.
export const majors = [
  // --- Công nghệ thông tin ---
  'Công nghệ thông tin', 'Khoa học máy tính', 'Kỹ thuật phần mềm', 'Hệ thống thông tin',
  'An toàn thông tin', 'Trí tuệ nhân tạo', 'Khoa học dữ liệu', 'Mạng máy tính và truyền thông dữ liệu',
  'Công nghệ đa phương tiện', 'Công nghệ thông tin (Việt–Nhật)',

  // --- Kỹ thuật – Công nghệ ---
  'Kỹ thuật điện', 'Kỹ thuật điện tử - viễn thông', 'Kỹ thuật điều khiển và tự động hóa',
  'Kỹ thuật cơ khí', 'Kỹ thuật cơ điện tử', 'Kỹ thuật ô tô', 'Kỹ thuật nhiệt',
  'Kỹ thuật hàng không', 'Kỹ thuật tàu thủy', 'Công nghệ chế tạo máy', 'Công nghệ kỹ thuật cơ khí',
  'Kỹ thuật xây dựng', 'Kỹ thuật xây dựng công trình giao thông', 'Kỹ thuật cấp thoát nước',
  'Kiến trúc', 'Quy hoạch vùng và đô thị', 'Kỹ thuật vật liệu', 'Khoa học vật liệu',
  'Kỹ thuật hóa học', 'Công nghệ kỹ thuật hóa học', 'Kỹ thuật môi trường',
  'Kỹ thuật dầu khí', 'Kỹ thuật mỏ', 'Kỹ thuật địa chất', 'Kỹ thuật trắc địa - bản đồ',
  'Công nghệ thực phẩm', 'Công nghệ sinh học', 'Công nghệ sau thu hoạch',
  'Công nghệ dệt may', 'Công nghệ da giày', 'Công nghệ in', 'Kỹ thuật y sinh',
  'Logistics và quản lý chuỗi cung ứng', 'Quản lý công nghiệp',

  // --- Kinh tế – Kinh doanh – Quản lý ---
  'Quản trị kinh doanh', 'Kinh doanh quốc tế', 'Marketing', 'Thương mại điện tử',
  'Quản trị nhân lực', 'Quản trị dịch vụ du lịch và lữ hành', 'Quản trị khách sạn',
  'Kinh tế', 'Kinh tế quốc tế', 'Kinh tế đối ngoại', 'Kinh tế đầu tư', 'Kinh tế phát triển',
  'Tài chính - Ngân hàng', 'Kế toán', 'Kiểm toán', 'Bảo hiểm', 'Bất động sản',
  'Quản lý dự án', 'Quản lý kinh tế', 'Toán kinh tế',

  // --- Khoa học tự nhiên ---
  'Toán học', 'Toán ứng dụng', 'Vật lý học', 'Hóa học', 'Sinh học',
  'Khoa học môi trường', 'Địa lý học', 'Địa chất học', 'Hải dương học', 'Thống kê',

  // --- Khoa học xã hội – Nhân văn ---
  'Luật', 'Luật kinh tế', 'Luật quốc tế', 'Xã hội học', 'Tâm lý học', 'Công tác xã hội',
  'Quan hệ quốc tế', 'Quốc tế học', 'Đông phương học', 'Việt Nam học',
  'Báo chí', 'Truyền thông đa phương tiện', 'Quan hệ công chúng', 'Xuất bản',
  'Lịch sử', 'Triết học', 'Văn học', 'Văn hóa học', 'Du lịch', 'Quản trị văn phòng',

  // --- Ngôn ngữ ---
  'Ngôn ngữ Anh', 'Ngôn ngữ Nhật', 'Ngôn ngữ Hàn Quốc', 'Ngôn ngữ Trung Quốc',
  'Ngôn ngữ Pháp', 'Ngôn ngữ Đức', 'Ngôn ngữ Nga', 'Sư phạm Tiếng Anh',

  // --- Sư phạm – Giáo dục ---
  'Giáo dục mầm non', 'Giáo dục tiểu học', 'Giáo dục thể chất', 'Quản lý giáo dục',
  'Sư phạm Toán học', 'Sư phạm Ngữ văn', 'Sư phạm Vật lý', 'Sư phạm Hóa học', 'Sư phạm Sinh học',

  // --- Y – Dược – Sức khỏe ---
  'Y khoa (Bác sĩ đa khoa)', 'Y học cổ truyền', 'Y học dự phòng', 'Răng - Hàm - Mặt',
  'Dược học', 'Điều dưỡng', 'Hộ sinh', 'Kỹ thuật xét nghiệm y học', 'Kỹ thuật hình ảnh y học',
  'Kỹ thuật phục hồi chức năng', 'Y tế công cộng', 'Dinh dưỡng',

  // --- Nông – Lâm – Ngư ---
  'Nông nghiệp', 'Khoa học cây trồng', 'Chăn nuôi', 'Thú y', 'Lâm nghiệp',
  'Nuôi trồng thủy sản', 'Bảo vệ thực vật', 'Quản lý đất đai', 'Kinh tế nông nghiệp',
  'Công nghệ rau hoa quả và cảnh quan',

  // --- Nghệ thuật – Thể thao ---
  'Thiết kế đồ họa', 'Thiết kế thời trang', 'Thiết kế nội thất', 'Thiết kế công nghiệp',
  'Mỹ thuật', 'Thanh nhạc', 'Diễn viên kịch - điện ảnh', 'Đạo diễn', 'Nhiếp ảnh',
  'Quản lý thể dục thể thao', 'Huấn luyện thể thao',

  // --- Khác ---
  'Ngành khác (nhập tay)',
];
