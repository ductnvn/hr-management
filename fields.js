// Định nghĩa toàn bộ trường thông tin nhân sự — nguồn sự thật duy nhất cho server & client.
// Cấu trúc đã được hiệu chỉnh khớp với file dữ liệu thực tế của công ty (song ngữ Việt–Anh).
// Mỗi trường có `label` (Tiếng Việt) và `label_en` (Tiếng Anh) phục vụ chuyển ngôn ngữ.
//
//   key      - tên cột DB / field
//   label    - nhãn Tiếng Việt
//   label_en - nhãn Tiếng Anh
//   type     - text | textarea | date | tel | email | number | select | datalist
//   options  - danh sách lựa chọn (select / datalist)
//   required - bắt buộc nhập
//   self     - mặc định cho phép nhân sự tự cập nhật qua link chia sẻ

import { schools } from './schools.js';
import { majors } from './majors.js';

const REGIONS = ['The North', 'The Central', 'The South', 'Central Highlands', 'Mekong Delta'];
const DEPARTMENTS = ['Production', 'Maintenance', 'Quality (QA/QC)', 'Warehouse', 'Engineering', 'R&D', 'Planning', 'Purchasing', 'HR & Admin', 'Accounting', 'Finance', 'Sales', 'IT', 'HSE', 'Management'];
const SALARY_TYPES = ['Hourly', 'Salary', 'Salary 1', 'Salary 2', 'Salary 3'];
const LEVELS = ['Director', 'Manager', 'Supervisor', 'Team Leader', 'Nonmanager', 'Worker'];
const RECRUIT_TYPES = ['New HC', 'Replacement', 'Seasonal', 'Internship', 'Outsourced'];
const RECRUIT_SOURCES = [
  'Giới thiệu nội bộ (nhân viên)', 'Website tuyển dụng (VietnamWorks, TopCV, CareerBuilder…)',
  'ITviec', 'LinkedIn', 'Facebook / Mạng xã hội', 'Website công ty / Ứng viên tự nộp',
  'Công ty tuyển dụng / Headhunter', 'Trung tâm giới thiệu việc làm', 'Ngày hội việc làm (Job Fair)',
  'Trường / Đại học (Campus)', 'Tuyển dụng nội bộ / Điều chuyển', 'Nhân viên cũ quay lại (Rehire)',
];

export const groups = [
  {
    title: 'Thông tin cá nhân', title_en: 'Personal Information', icon: '👤',
    fields: [
      { key: 'employee_code', label: 'Mã số', label_en: 'Employee Code', type: 'text', required: true },
      { key: 'full_name', label: 'Họ và tên', label_en: 'Full Name', type: 'text', required: true },
      { key: 'gender', label: 'Giới tính', label_en: 'Gender', type: 'select', options: ['Nam', 'Nữ', 'Khác'] },
      { key: 'date_of_birth', label: 'Ngày sinh', label_en: 'Date of Birth', type: 'date' },
      { key: 'place_of_birth', label: 'Nơi sinh', label_en: 'Place of Birth', type: 'text', self: true },
      { key: 'national_id', label: 'Số CCCD/CMND', label_en: 'ID Card No.', type: 'text', self: true },
      { key: 'tax_code', label: 'Mã số thuế cá nhân', label_en: 'Personal Tax Code', type: 'text', self: true },
      { key: 'phone', label: 'Số điện thoại', label_en: 'Phone Number', type: 'tel', self: true },
      { key: 'email', label: 'Email', label_en: 'Email', type: 'email', self: true },
      { key: 'marital_status', label: 'Tình trạng hôn nhân', label_en: 'Marital Status', type: 'select', options: ['Độc thân', 'Đã kết hôn', 'Khác'], self: true },
    ],
  },
  {
    title: 'Học vấn', title_en: 'Education', icon: '🎓',
    fields: [
      { key: 'education_level', label: 'Học vấn / Trình độ', label_en: 'Education Level', type: 'select', options: ['THCS', 'THPT', 'Trung cấp', 'Cao đẳng (CĐ)', 'Đại học (ĐH)', 'Sau đại học'] },
      { key: 'school_name', label: 'Tên trường học', label_en: 'School / University', type: 'datalist', options: schools, self: true },
      { key: 'major', label: 'Tên ngành học', label_en: 'Major', type: 'datalist', options: majors, self: true },
    ],
  },
  {
    title: 'Địa chỉ & Liên hệ', title_en: 'Address & Contact', icon: '🏠',
    fields: [
      { key: 'permanent_ward', label: 'Xã / Phường', label_en: 'Ward', type: 'text', self: true },
      { key: 'permanent_province', label: 'Tỉnh / Thành phố', label_en: 'Province / City', type: 'text', self: true },
      { key: 'permanent_address', label: 'Địa chỉ thường trú (đầy đủ)', label_en: 'Permanent Address (full)', type: 'textarea', self: true },
      { key: 'region', label: 'Khu vực', label_en: 'Region', type: 'datalist', options: REGIONS },
      { key: 'current_address', label: 'Chỗ ở hiện tại', label_en: 'Current Address', type: 'textarea', self: true },
      { key: 'emergency_contact_name', label: 'Người liên hệ khẩn cấp', label_en: 'Emergency Contact', type: 'text', self: true },
      { key: 'emergency_contact_phone', label: 'SĐT liên hệ khẩn cấp', label_en: 'Emergency Phone', type: 'tel', self: true },
    ],
  },
  {
    title: 'Thông tin công việc', title_en: 'Job Information', icon: '🏭',
    fields: [
      { key: 'department', label: 'Bộ phận', label_en: 'Department', type: 'datalist', options: DEPARTMENTS },
      { key: 'position', label: 'Vị trí', label_en: 'Position', type: 'text' },
      { key: 'job_title', label: 'Chức danh', label_en: 'Job Title', type: 'text' },
      { key: 'job_description', label: 'Công việc phải làm', label_en: 'Job Description', type: 'textarea' },
      { key: 'level', label: 'Cấp bậc (Level)', label_en: 'Level', type: 'datalist', options: LEVELS },
      { key: 'salary_type', label: 'Nhóm lương (giờ / cố định)', label_en: 'Salary Type (hourly/fixed)', type: 'datalist', options: SALARY_TYPES },
      { key: 'direct_manager', label: 'Quản lý trực tiếp', label_en: 'Direct Manager', type: 'text' },
      { key: 'head_of_department', label: 'Trưởng bộ phận', label_en: 'Head of Department', type: 'text' },
      { key: 'hire_date', label: 'Ngày gia nhập', label_en: 'Joined Date', type: 'date' },
      { key: 'status', label: 'Trạng thái', label_en: 'Status', type: 'select', options: ['Đang làm việc', 'Nghỉ thai sản', 'Tạm hoãn HĐ', 'Đã nghỉ việc'] },
      { key: 'resignation_date', label: 'Ngày nghỉ việc', label_en: 'Resigned Date', type: 'date' },
      { key: 'recruitment_type', label: 'Loại hình tuyển dụng', label_en: 'Recruitment Type', type: 'datalist', options: RECRUIT_TYPES },
      { key: 'recruitment_source', label: 'Nguồn tuyển dụng', label_en: 'Recruitment Source', type: 'datalist', options: RECRUIT_SOURCES },
      { key: 'factory', label: 'Nhà máy / Xưởng', label_en: 'Factory / Plant', type: 'text' },
      { key: 'production_line', label: 'Dây chuyền / Tổ', label_en: 'Production Line', type: 'text' },
      { key: 'shift', label: 'Ca làm việc', label_en: 'Work Shift', type: 'select', options: ['Hành chính', 'Ca 1', 'Ca 2', 'Ca 3', 'Ca gãy'] },
    ],
  },
  {
    title: 'Hợp đồng lao động', title_en: 'Labour Contract', icon: '📄',
    fields: [
      { key: 'contract_type', label: 'Loại hợp đồng lao động', label_en: 'Labour Contract Type', type: 'select', options: ['Thử việc', 'Xác định thời hạn', 'Không xác định thời hạn', 'Thời vụ / Khoán'] },
      { key: 'probation_no', label: 'Số HĐ thử việc', label_en: 'Probation Contract No.', type: 'text' },
      { key: 'probation_from', label: 'Thử việc từ ngày', label_en: 'Probation From', type: 'date' },
      { key: 'probation_to', label: 'Thử việc đến ngày', label_en: 'Probation To', type: 'date' },
      { key: 'contract1_no', label: 'Số HĐ lần 1', label_en: 'Contract 1 No.', type: 'text' },
      { key: 'contract1_from', label: 'HĐ lần 1 từ ngày', label_en: 'Contract 1 From', type: 'date' },
      { key: 'contract1_to', label: 'HĐ lần 1 đến ngày', label_en: 'Contract 1 To', type: 'date' },
      { key: 'contract2_no', label: 'Số HĐ lần 2', label_en: 'Contract 2 No.', type: 'text' },
      { key: 'contract2_from', label: 'HĐ lần 2 từ ngày', label_en: 'Contract 2 From', type: 'date' },
      { key: 'contract2_to', label: 'HĐ lần 2 đến ngày', label_en: 'Contract 2 To', type: 'date' },
      { key: 'contract3_no', label: 'Số HĐ không xác định thời hạn', label_en: 'Unlimited Contract No.', type: 'text' },
      { key: 'contract3_from', label: 'HĐ KXĐTH từ ngày', label_en: 'Unlimited Contract From', type: 'date' },
      { key: 'contract3_to', label: 'HĐ KXĐTH đến ngày', label_en: 'Unlimited Contract To', type: 'date' },
    ],
  },
  {
    title: 'Lương & Bảo hiểm', title_en: 'Salary & Insurance', icon: '💳',
    fields: [
      { key: 'base_salary', label: 'Lương cơ bản (VNĐ)', label_en: 'Base Salary (VND)', type: 'number' },
      { key: 'salary_grade', label: 'Bậc lương', label_en: 'Salary Grade', type: 'text' },
      { key: 'bank_name', label: 'Ngân hàng', label_en: 'Bank', type: 'text', self: true },
      { key: 'bank_account', label: 'Số tài khoản', label_en: 'Bank Account No.', type: 'text', self: true },
      { key: 'social_insurance_no', label: 'Số sổ BHXH', label_en: 'Social Insurance No.', type: 'text' },
      { key: 'health_insurance_no', label: 'Số thẻ BHYT', label_en: 'Health Insurance No.', type: 'text' },
    ],
  },
  {
    title: 'Khác', title_en: 'Other', icon: '📝',
    fields: [
      { key: 'notes', label: 'Ghi chú', label_en: 'Notes', type: 'textarea' },
    ],
  },
];

export const fields = groups.flatMap((g) => g.fields);
export const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));
export const fieldKeys = fields.map((f) => f.key);

// ===========================================================================
// SCHEMA THỰC TẬP SINH (INTERN)
// `apply: true` = trường hiển thị trên form ứng tuyển công khai cho ứng viên.
// ===========================================================================
const YEAR_OPTIONS = ['1st year (Năm 1)', '2nd year (Năm 2)', '3rd year (Năm 3)', 'Final year (Năm cuối)', 'Fresh Graduate (Mới tốt nghiệp)', 'Other (Khác)'];
const INTERN_POSITIONS = ['CNC Intern', 'QA/QC Intern', 'Mechanical/Electrical Intern', 'Back Office Intern (HR, Finance, Supply Chain, Purchasing, etc.)'];
const INTERN_STATUS = ['Mới nộp (New)', 'Đang xem xét (Reviewing)', 'Phỏng vấn (Interview)', 'Nhận (Accepted)', 'Từ chối (Rejected)', 'Đã kết thúc (Completed)'];

export const internGroups = [
  {
    title: 'Thông tin ứng viên', title_en: 'Applicant Information', icon: '🎓',
    fields: [
      { key: 'full_name', label: 'Họ và Tên', label_en: 'Full Name', type: 'text', required: true, apply: true },
      { key: 'phone', label: 'Số điện thoại liên hệ', label_en: 'Phone Number', type: 'tel', required: true, apply: true },
      { key: 'email', label: 'Địa chỉ Email', label_en: 'Email Address', type: 'email', required: true, apply: true },
      { key: 'university', label: 'Trường Đại học / Cao đẳng', label_en: 'University / College', type: 'datalist', options: schools, required: true, apply: true },
      { key: 'major', label: 'Chuyên ngành', label_en: 'Major', type: 'datalist', options: majors, apply: true },
      { key: 'year_of_study', label: 'Sinh viên năm thứ', label_en: 'Current Year of Study', type: 'select', options: YEAR_OPTIONS, required: true, apply: true },
      { key: 'position_applied', label: 'Vị trí ứng tuyển', label_en: 'Position Applying For', type: 'select', options: INTERN_POSITIONS, required: true, apply: true },
      { key: 'expected_start', label: 'Thời gian bắt đầu dự kiến', label_en: 'Expected Start Date', type: 'date', apply: true },
      { key: 'expected_end', label: 'Thời gian kết thúc dự kiến', label_en: 'Expected End Date', type: 'date', apply: true },
    ],
  },
  {
    title: 'Theo dõi (nội bộ)', title_en: 'Tracking (internal)', icon: '🗂️',
    fields: [
      { key: 'status', label: 'Trạng thái', label_en: 'Status', type: 'select', options: INTERN_STATUS },
      { key: 'notes', label: 'Ghi chú', label_en: 'Notes', type: 'textarea' },
    ],
  },
];

export const internFields = internGroups.flatMap((g) => g.fields);
export const internFieldByKey = Object.fromEntries(internFields.map((f) => [f.key, f]));
export const internFieldKeys = internFields.map((f) => f.key);
export const internApplyKeys = internFields.filter((f) => f.apply).map((f) => f.key);
