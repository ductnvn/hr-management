// Lớp truy cập dữ liệu — dùng SQLite tích hợp sẵn của Node (node:sqlite), không cần cài thêm.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fieldKeys, internFieldKeys } from './fields.js';

// Đường dẫn DB có thể trỏ vào Volume bền (vd HR_DB=/data/hr.db trên Railway/Render).
// Tự tạo thư mục chứa nếu chưa có, tránh lỗi khi mount volume ở thư mục mới.
const DB_PATH = process.env.HR_DB || 'hr.db';
try { const dir = dirname(DB_PATH); if (dir && dir !== '.') mkdirSync(dir, { recursive: true }); } catch { /* bỏ qua */ }

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// --- Tạo bảng ---------------------------------------------------------------
const employeeColumns = fieldKeys.map((k) => `  "${k}" TEXT`).join(',\n');
db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
${employeeColumns},
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_code ON employees(employee_code);
`);

// Tự động thêm cột mới khi định nghĩa trong fields.js thay đổi (không mất dữ liệu cũ).
const existingCols = new Set(db.prepare('PRAGMA table_info(employees)').all().map((c) => c.name));
for (const k of fieldKeys) {
  if (!existingCols.has(k)) db.exec(`ALTER TABLE employees ADD COLUMN "${k}" TEXT`);
}

db.exec(`

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  allowed_fields TEXT NOT NULL,   -- JSON mảng key
  require_dob INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,                -- 'YYYY-MM-DD' hoặc NULL
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS self_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  employee_id INTEGER,
  employee_code TEXT,
  full_name TEXT,
  changes TEXT,                   -- JSON {field: {from, to}}
  submitted_at TEXT NOT NULL
);
`);

// --- Bảng thực tập sinh -----------------------------------------------------
const internColumns = internFieldKeys.map((k) => `  "${k}" TEXT`).join(',\n');
db.exec(`
CREATE TABLE IF NOT EXISTS interns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
${internColumns},
  source TEXT,                    -- 'admin' | 'public'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
const internExisting = new Set(db.prepare('PRAGMA table_info(interns)').all().map((c) => c.name));
for (const k of internFieldKeys) {
  if (!internExisting.has(k)) db.exec(`ALTER TABLE interns ADD COLUMN "${k}" TEXT`);
}
// Cột đính kèm CV (lưu ngay trong DB dưới dạng BLOB).
for (const col of ['cv_filename TEXT', 'cv_mime TEXT', 'cv_data BLOB']) {
  const name = col.split(' ')[0];
  if (!internExisting.has(name)) db.exec(`ALTER TABLE interns ADD COLUMN ${col}`);
}

// Cột trả về cho client (KHÔNG kèm cv_data để tránh gửi binary lớn; thay bằng cờ has_cv).
const internSelectCols =
  ['id', ...internFieldKeys, 'source', 'created_at', 'updated_at', 'cv_filename', 'cv_mime']
    .map((c) => `"${c}"`).join(', ') + ', CASE WHEN cv_data IS NOT NULL THEN 1 ELSE 0 END AS has_cv';

const now = () => new Date().toISOString();

// --- Nhân sự ----------------------------------------------------------------
export function listEmployees(q) {
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    return db
      .prepare(
        `SELECT * FROM employees
         WHERE employee_code LIKE ? OR full_name LIKE ? OR phone LIKE ?
            OR department LIKE ? OR position LIKE ?
         ORDER BY id DESC`
      )
      .all(like, like, like, like, like);
  }
  return db.prepare('SELECT * FROM employees ORDER BY id DESC').all();
}

export function getEmployee(id) {
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
}

export function getEmployeeByCode(code) {
  return db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(code);
}

export function createEmployee(data) {
  const cols = fieldKeys.filter((k) => data[k] !== undefined);
  const ts = now();
  const allCols = [...cols, 'created_at', 'updated_at'];
  const placeholders = allCols.map(() => '?').join(', ');
  const values = [...cols.map((k) => nz(data[k])), ts, ts];
  const stmt = db.prepare(
    `INSERT INTO employees (${allCols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
  );
  const info = stmt.run(...values);
  return getEmployee(info.lastInsertRowid);
}

export function updateEmployee(id, data) {
  const cols = fieldKeys.filter((k) => data[k] !== undefined);
  if (cols.length === 0) return getEmployee(id);
  const set = [...cols.map((k) => `"${k}" = ?`), 'updated_at = ?'].join(', ');
  const values = [...cols.map((k) => nz(data[k])), now(), id];
  db.prepare(`UPDATE employees SET ${set} WHERE id = ?`).run(...values);
  return getEmployee(id);
}

export function deleteEmployee(id) {
  return db.prepare('DELETE FROM employees WHERE id = ?').run(id).changes > 0;
}

// --- Chiến dịch cập nhật (share link) --------------------------------------
export function listCampaigns() {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY id DESC').all();
  return rows.map((r) => ({
    ...r,
    allowed_fields: JSON.parse(r.allowed_fields),
    active: !!r.active,
    require_dob: !!r.require_dob,
    submissions: db
      .prepare('SELECT COUNT(*) AS c FROM self_updates WHERE campaign_id = ?')
      .get(r.id).c,
  }));
}

export function getCampaignByToken(token) {
  const r = db.prepare('SELECT * FROM campaigns WHERE token = ?').get(token);
  if (!r) return null;
  return { ...r, allowed_fields: JSON.parse(r.allowed_fields), active: !!r.active, require_dob: !!r.require_dob };
}

export function createCampaign({ title, allowed_fields, expires_at, require_dob }) {
  const token = randomBytes(9).toString('base64url');
  db.prepare(
    `INSERT INTO campaigns (token, title, allowed_fields, require_dob, expires_at, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(token, title, JSON.stringify(allowed_fields), require_dob ? 1 : 0, expires_at || null, now());
  return getCampaignByToken(token);
}

export function setCampaignActive(id, active) {
  db.prepare('UPDATE campaigns SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export function deleteCampaign(id) {
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}

// --- Lịch sử tự cập nhật ----------------------------------------------------
export function logSelfUpdate(entry) {
  db.prepare(
    `INSERT INTO self_updates (campaign_id, employee_id, employee_code, full_name, changes, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(entry.campaign_id, entry.employee_id, entry.employee_code, entry.full_name, JSON.stringify(entry.changes), now());
}

export function listSelfUpdates() {
  return db
    .prepare('SELECT * FROM self_updates ORDER BY id DESC LIMIT 200')
    .all()
    .map((r) => ({ ...r, changes: JSON.parse(r.changes) }));
}

export function countEmployees() {
  return db.prepare('SELECT COUNT(*) AS c FROM employees').get().c;
}

// --- Nhập hàng loạt (import) ------------------------------------------------
// records: mảng object {field: value}. Cập nhật theo employee_code nếu đã tồn tại, ngược lại tạo mới.
export function importEmployees(records) {
  let created = 0, updated = 0;
  const errors = [];
  db.exec('BEGIN');
  try {
    records.forEach((rec, i) => {
      const code = (rec.employee_code || '').trim();
      if (!code) { errors.push({ row: i, message: 'Thiếu Mã số (employee_code)' }); return; }
      const existing = getEmployeeByCode(code);
      if (existing) { updateEmployee(existing.id, rec); updated++; }
      else { createEmployee(rec); created++; }
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { created, updated, errors };
}

function nz(v) {
  return v === undefined || v === null ? '' : String(v);
}

// --- Thực tập sinh ----------------------------------------------------------
export function listInterns(q) {
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    return db
      .prepare(
        `SELECT ${internSelectCols} FROM interns
         WHERE full_name LIKE ? OR phone LIKE ? OR email LIKE ?
            OR university LIKE ? OR position_applied LIKE ?
         ORDER BY id DESC`
      )
      .all(like, like, like, like, like);
  }
  return db.prepare(`SELECT ${internSelectCols} FROM interns ORDER BY id DESC`).all();
}
export function getIntern(id) {
  return db.prepare(`SELECT ${internSelectCols} FROM interns WHERE id = ?`).get(id);
}
export function setInternCv(id, filename, mime, buffer) {
  db.prepare('UPDATE interns SET cv_filename = ?, cv_mime = ?, cv_data = ?, updated_at = ? WHERE id = ?')
    .run(filename, mime, buffer, now(), id);
}
export function getInternCv(id) {
  return db.prepare('SELECT cv_filename, cv_mime, cv_data FROM interns WHERE id = ?').get(id);
}
export function createIntern(data, source = 'admin') {
  const cols = internFieldKeys.filter((k) => data[k] !== undefined);
  const ts = now();
  const allCols = [...cols, 'source', 'created_at', 'updated_at'];
  const placeholders = allCols.map(() => '?').join(', ');
  const values = [...cols.map((k) => nz(data[k])), source, ts, ts];
  const info = db
    .prepare(`INSERT INTO interns (${allCols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`)
    .run(...values);
  return getIntern(info.lastInsertRowid);
}
export function updateIntern(id, data) {
  const cols = internFieldKeys.filter((k) => data[k] !== undefined);
  if (cols.length === 0) return getIntern(id);
  const set = [...cols.map((k) => `"${k}" = ?`), 'updated_at = ?'].join(', ');
  const values = [...cols.map((k) => nz(data[k])), now(), id];
  db.prepare(`UPDATE interns SET ${set} WHERE id = ?`).run(...values);
  return getIntern(id);
}
export function deleteIntern(id) {
  return db.prepare('DELETE FROM interns WHERE id = ?').run(id).changes > 0;
}
export function countInterns() {
  return db.prepare('SELECT COUNT(*) AS c FROM interns').get().c;
}

// --- Sao lưu / Khôi phục toàn bộ dữ liệu ------------------------------------
const BACKUP_TABLES = ['employees', 'interns', 'campaigns', 'self_updates'];
function tableColumns(name) {
  return db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name);
}
function dumpTable(name) {
  const cols = tableColumns(name);
  return db.prepare(`SELECT * FROM ${name}`).all().map((r) => {
    const o = {};
    for (const k of cols) {
      let v = r[k];
      if (v instanceof Uint8Array) v = { __b64: Buffer.from(v).toString('base64') }; // BLOB (CV) → base64
      o[k] = v;
    }
    return o;
  });
}
export function dumpAll() {
  const tables = {};
  for (const t of BACKUP_TABLES) tables[t] = dumpTable(t);
  return { app: 'hr-management', version: 1, exportedAt: now(), tables };
}
export function restoreAll(data) {
  if (!data || !data.tables) throw new Error('File sao lưu không hợp lệ');
  const counts = {};
  db.exec('BEGIN');
  try {
    for (const name of BACKUP_TABLES) {
      const rows = data.tables[name];
      if (!Array.isArray(rows)) continue;
      const cols = new Set(tableColumns(name));
      db.exec(`DELETE FROM ${name}`);
      for (const r of rows) {
        const keys = Object.keys(r).filter((k) => cols.has(k));
        const vals = keys.map((k) => {
          let v = r[k];
          if (v && typeof v === 'object' && v.__b64 !== undefined) v = Buffer.from(v.__b64, 'base64');
          return v;
        });
        db.prepare(`INSERT INTO ${name} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
      }
      counts[name] = rows.length;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return counts;
}

// --- Dữ liệu mẫu ------------------------------------------------------------
if (countEmployees() === 0) {
  const samples = [
    { employee_code: '21707', full_name: 'Lê Văn Pha', gender: 'Nam', date_of_birth: '1995-08-21', place_of_birth: 'Phú Yên', department: 'Maintenance', position: 'Technician', job_title: 'Maintenance Technician', job_description: 'Nhân viên bảo trì', level: 'Nonmanager', salary_type: 'Salary 2', direct_manager: 'Son Nguyen', head_of_department: 'Son Nguyen', education_level: 'Đại học (ĐH)', hire_date: '2025-02-20', status: 'Đang làm việc', recruitment_type: 'New HC', region: 'The Central', permanent_ward: 'Xã Hòa Thịnh', permanent_province: 'Tỉnh Đắk Lắk', permanent_address: 'Phú Diễn Trong, Xã Hòa Thịnh, Tỉnh Đắk Lắk', contract_type: 'Xác định thời hạn', contract1_no: '21707/1-04/2025-THX', contract1_from: '2025-04-16', contract1_to: '2026-04-15' },
    { employee_code: 'NV0002', full_name: 'Trần Thị Bình', gender: 'Nữ', date_of_birth: '1995-08-20', phone: '0912345678', email: 'binh.tt@congty.vn', department: 'Quality (QA/QC)', position: 'Inspector', job_title: 'QC Inspector', level: 'Nonmanager', education_level: 'Cao đẳng (CĐ)', hire_date: '2020-01-15', status: 'Đang làm việc', recruitment_type: 'Replacement', region: 'The Central', contract_type: 'Không xác định thời hạn' },
    { employee_code: 'NV0003', full_name: 'Lê Hoàng Cường', gender: 'Nam', date_of_birth: '1988-11-05', phone: '0987654321', email: 'cuong.lh@congty.vn', department: 'Production', position: 'Team Leader', job_title: 'Production Line Leader', level: 'Team Leader', education_level: 'Đại học (ĐH)', hire_date: '2016-09-10', status: 'Đang làm việc', factory: 'Plant 2', production_line: 'Line A', shift: 'Ca 2', recruitment_type: 'New HC', region: 'The Central', contract_type: 'Không xác định thời hạn' },
  ];
  for (const s of samples) createEmployee(s);
}

if (countInterns() === 0) {
  const internSamples = [
    { full_name: 'Phạm Minh Khoa', phone: '0905112233', email: 'khoa.pm@gmail.com', university: 'Trường Đại học Bách khoa - Đại học Đà Nẵng', major: 'Kỹ thuật cơ khí', year_of_study: 'Final year (Năm cuối)', position_applied: 'CNC Intern', expected_start: '2026-08-01', expected_end: '2026-11-30', status: 'Mới nộp (New)' },
    { full_name: 'Nguyễn Thị Hồng', phone: '0938446677', email: 'hong.nt@gmail.com', university: 'Trường Đại học Kinh tế - Đại học Đà Nẵng', major: 'Quản trị nhân lực', year_of_study: '3rd year (Năm 3)', position_applied: 'Back Office Intern (HR, Finance, Supply Chain, Purchasing, etc.)', expected_start: '2026-07-15', expected_end: '2026-10-15', status: 'Đang xem xét (Reviewing)' },
  ];
  for (const s of internSamples) createIntern(s, 'admin');
}

export default db;
