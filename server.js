// Máy chủ HTTP thuần Node — không dùng framework, không phụ thuộc npm.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { groups, fields, fieldByKey, fieldKeys, internGroups, internFields, internFieldByKey, internApplyKeys } from './fields.js';
import * as store from './db.js';
import { parseXlsx, parseCsv } from './xlsx.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Phiên đăng nhập admin (lưu trong bộ nhớ — khởi động lại sẽ cần đăng nhập lại).
const sessions = new Set();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = decodeURIComponent(url.pathname);

    if (path.startsWith('/api/')) return await handleApi(req, res, url, path);

    // Trang cập nhật công khai: /update/<token>
    if (path === '/' || path === '/index.html') return sendFile(res, join(PUBLIC, 'index.html'));
    if (path.startsWith('/update/')) return sendFile(res, join(PUBLIC, 'update.html'));
    if (path === '/apply' || path.startsWith('/apply/')) return sendFile(res, join(PUBLIC, 'apply.html'));

    // File tĩnh trong /public
    const safe = join(PUBLIC, path.replace(/^\/+/, ''));
    if (!safe.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
    return sendFile(res, safe);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Lỗi máy chủ: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
async function handleApi(req, res, url, path) {
  const method = req.method;

  // --- Công khai (không cần đăng nhập) ---
  if (path === '/api/login' && method === 'POST') {
    const body = await readBody(req);
    if (body.password === ADMIN_PASSWORD) {
      const token = randomBytes(24).toString('base64url');
      sessions.add(token);
      return sendJson(res, 200, { token });
    }
    return sendJson(res, 401, { error: 'Sai mật khẩu' });
  }

  if (path === '/api/fields' && method === 'GET') {
    return sendJson(res, 200, { groups, fields });
  }

  // Schema thực tập sinh (công khai — form ứng tuyển cần đọc)
  if (path === '/api/intern-fields' && method === 'GET') {
    return sendJson(res, 200, { groups: internGroups, fields: internFields });
  }

  // Ứng viên thực tập nộp đơn (công khai, tạo bản ghi mới)
  if (path === '/api/public/intern-apply' && method === 'POST') {
    const body = await readBody(req);
    const values = body.values || {};
    const data = {};
    for (const k of internApplyKeys) if (values[k] !== undefined) data[k] = String(values[k]);
    for (const f of internFields) {
      if (f.required && f.apply && (!data[f.key] || !data[f.key].trim()))
        return sendJson(res, 400, { error: `Thiếu thông tin bắt buộc: ${f.label}` });
    }
    data.status = 'Mới nộp (New)';
    store.createIntern(data, 'public');
    return sendJson(res, 201, { ok: true });
  }

  // Endpoint công khai cho nhân sự tự cập nhật
  const pub = path.match(/^\/api\/public\/campaign\/([^/]+)(\/lookup|\/submit)?$/);
  if (pub) return handlePublicCampaign(req, res, pub[1], pub[2], method);

  // --- Từ đây trở đi cần đăng nhập admin ---
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!sessions.has(auth)) return sendJson(res, 401, { error: 'Chưa đăng nhập' });

  // Nhân sự
  if (path === '/api/employees' && method === 'GET')
    return sendJson(res, 200, store.listEmployees(url.searchParams.get('q')));
  if (path === '/api/employees' && method === 'POST') {
    const body = await readBody(req);
    const err = validate(body);
    if (err) return sendJson(res, 400, { error: err });
    if (body.employee_code && store.getEmployeeByCode(body.employee_code))
      return sendJson(res, 409, { error: 'Mã nhân viên đã tồn tại' });
    return sendJson(res, 201, store.createEmployee(body));
  }
  if (path === '/api/employees.csv' && method === 'GET') return exportCsv(res);

  const empMatch = path.match(/^\/api\/employees\/(\d+)$/);
  if (empMatch) {
    const id = Number(empMatch[1]);
    if (method === 'GET') {
      const e = store.getEmployee(id);
      return e ? sendJson(res, 200, e) : sendJson(res, 404, { error: 'Không tìm thấy' });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const err = validate(body);
      if (err) return sendJson(res, 400, { error: err });
      const dup = body.employee_code && store.getEmployeeByCode(body.employee_code);
      if (dup && dup.id !== id) return sendJson(res, 409, { error: 'Mã nhân viên đã tồn tại' });
      return sendJson(res, 200, store.updateEmployee(id, body));
    }
    if (method === 'DELETE')
      return sendJson(res, 200, { ok: store.deleteEmployee(id) });
  }

  // Chiến dịch cập nhật (share link)
  if (path === '/api/campaigns' && method === 'GET')
    return sendJson(res, 200, store.listCampaigns());
  if (path === '/api/campaigns' && method === 'POST') {
    const body = await readBody(req);
    if (!body.title || !body.title.trim()) return sendJson(res, 400, { error: 'Thiếu tiêu đề' });
    const allowed = (body.allowed_fields || []).filter((k) => fieldByKey[k]);
    if (allowed.length === 0) return sendJson(res, 400, { error: 'Chọn ít nhất 1 trường cho phép cập nhật' });
    return sendJson(res, 201, store.createCampaign({
      title: body.title.trim(), allowed_fields: allowed,
      expires_at: body.expires_at || null, require_dob: body.require_dob !== false,
    }));
  }
  const campMatch = path.match(/^\/api\/campaigns\/(\d+)$/);
  if (campMatch) {
    const id = Number(campMatch[1]);
    if (method === 'PATCH') {
      const body = await readBody(req);
      store.setCampaignActive(id, !!body.active);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'DELETE') { store.deleteCampaign(id); return sendJson(res, 200, { ok: true }); }
  }

  if (path === '/api/self-updates' && method === 'GET')
    return sendJson(res, 200, store.listSelfUpdates());

  // Thực tập sinh (admin)
  if (path === '/api/interns' && method === 'GET')
    return sendJson(res, 200, store.listInterns(url.searchParams.get('q')));
  if (path === '/api/interns' && method === 'POST') {
    const body = await readBody(req);
    const err = validateIntern(body);
    if (err) return sendJson(res, 400, { error: err });
    return sendJson(res, 201, store.createIntern(body, 'admin'));
  }
  if (path === '/api/interns.csv' && method === 'GET') return exportInternsCsv(res);
  const internMatch = path.match(/^\/api\/interns\/(\d+)$/);
  if (internMatch) {
    const id = Number(internMatch[1]);
    if (method === 'GET') {
      const it = store.getIntern(id);
      return it ? sendJson(res, 200, it) : sendJson(res, 404, { error: 'Không tìm thấy' });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const err = validateIntern(body);
      if (err) return sendJson(res, 400, { error: err });
      return sendJson(res, 200, store.updateIntern(id, body));
    }
    if (method === 'DELETE') return sendJson(res, 200, { ok: store.deleteIntern(id) });
  }

  // Nhập từ Excel/CSV: bước 1 — phân tích tệp thành lưới dữ liệu
  if (path === '/api/import/parse' && method === 'POST') {
    const body = await readBody(req);
    try {
      const buf = Buffer.from(body.dataBase64 || '', 'base64');
      const name = (body.filename || '').toLowerCase();
      let result;
      if (name.endsWith('.csv') || (buf[0] !== 0x50 && buf[1] !== 0x4b)) result = parseCsv(buf.toString('utf8'));
      else result = parseXlsx(buf);
      const MAX = 5000;
      const truncated = result.rows.length > MAX;
      return sendJson(res, 200, { sheet: result.sheet, rows: result.rows.slice(0, MAX), truncated });
    } catch (e) {
      return sendJson(res, 400, { error: 'Không đọc được tệp: ' + e.message });
    }
  }

  // Nhập từ Excel/CSV: bước 2 — ghi các bản ghi đã map vào DB
  if (path === '/api/import/commit' && method === 'POST') {
    const body = await readBody(req);
    const records = (body.records || []).map((r) => {
      const clean = {};
      for (const k of fieldKeys) if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') clean[k] = String(r[k]);
      return clean;
    });
    if (!records.length) return sendJson(res, 400, { error: 'Không có bản ghi nào để nhập' });
    try {
      return sendJson(res, 200, store.importEmployees(records));
    } catch (e) {
      return sendJson(res, 500, { error: 'Lỗi khi nhập: ' + e.message });
    }
  }

  return sendJson(res, 404, { error: 'Không tìm thấy endpoint' });
}

// --- Luồng công khai: nhân sự tự cập nhật qua link -------------------------
async function handlePublicCampaign(req, res, token, action, method) {
  const campaign = store.getCampaignByToken(token);
  const invalid = !campaign || !campaign.active ||
    (campaign.expires_at && campaign.expires_at < new Date().toISOString().slice(0, 10));

  if (!action && method === 'GET') {
    if (!campaign) return sendJson(res, 404, { error: 'Liên kết không tồn tại' });
    return sendJson(res, 200, {
      title: campaign.title,
      require_dob: campaign.require_dob,
      valid: !invalid,
      reason: invalid ? (!campaign.active ? 'Liên kết đã bị khóa' : 'Liên kết đã hết hạn') : null,
      fields: campaign.allowed_fields.map((k) => fieldByKey[k]).filter(Boolean),
    });
  }

  if (invalid) return sendJson(res, 403, { error: 'Liên kết không còn hiệu lực' });

  if (action === '/lookup' && method === 'POST') {
    const body = await readBody(req);
    const emp = verifyEmployee(campaign, body);
    if (!emp) return sendJson(res, 404, { error: 'Không tìm thấy nhân sự khớp thông tin xác thực' });
    const values = {};
    for (const k of campaign.allowed_fields) values[k] = emp[k] || '';
    return sendJson(res, 200, { full_name: emp.full_name, employee_code: emp.employee_code, values });
  }

  if (action === '/submit' && method === 'POST') {
    const body = await readBody(req);
    const emp = verifyEmployee(campaign, body);
    if (!emp) return sendJson(res, 404, { error: 'Không tìm thấy nhân sự khớp thông tin xác thực' });
    const values = body.values || {};
    const patch = {};
    const changes = {};
    for (const k of campaign.allowed_fields) {
      if (values[k] === undefined) continue;
      const nv = String(values[k]);
      if (nv !== (emp[k] || '')) changes[k] = { from: emp[k] || '', to: nv };
      patch[k] = nv;
    }
    store.updateEmployee(emp.id, patch);
    store.logSelfUpdate({
      campaign_id: campaign.id, employee_id: emp.id,
      employee_code: emp.employee_code, full_name: emp.full_name, changes,
    });
    return sendJson(res, 200, { ok: true, changed: Object.keys(changes).length });
  }

  return sendJson(res, 404, { error: 'Không tìm thấy' });
}

function verifyEmployee(campaign, body) {
  const emp = store.getEmployeeByCode((body.employee_code || '').trim());
  if (!emp) return null;
  if (campaign.require_dob && emp.date_of_birth) {
    if ((body.date_of_birth || '') !== emp.date_of_birth) return null;
  }
  return emp;
}

function validate(body) {
  for (const f of fields) {
    if (f.required && (!body[f.key] || !String(body[f.key]).trim()))
      return `Thiếu trường bắt buộc: ${f.label}`;
  }
  return null;
}
function validateIntern(body) {
  for (const f of internFields) {
    if (f.required && (!body[f.key] || !String(body[f.key]).trim()))
      return `Thiếu trường bắt buộc: ${f.label}`;
  }
  return null;
}

// --- CSV --------------------------------------------------------------------
function exportCsv(res) {
  const rows = store.listEmployees();
  const cols = ['id', ...fields.map((f) => f.key)];
  const header = ['ID', ...fields.map((f) => f.label)];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [header.map(esc).join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','));
  const csv = '﻿' + lines.join('\r\n'); // BOM để Excel đọc đúng tiếng Việt
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="nhan-su.csv"',
  });
  res.end(csv);
}

function exportInternsCsv(res) {
  const rows = store.listInterns();
  const cols = ['id', ...internFields.map((f) => f.key), 'created_at'];
  const header = ['ID', ...internFields.map((f) => f.label), 'Ngày nộp'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [header.map(esc).join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','));
  const csv = '﻿' + lines.join('\r\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="thuc-tap-sinh.csv"',
  });
  res.end(csv);
}

// --- Tiện ích HTTP ----------------------------------------------------------
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}
function send(res, code, text) { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); }
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
async function sendFile(res, file) {
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { send(res, 404, 'Không tìm thấy tệp'); }
}

server.listen(PORT, () => {
  console.log(`\n  ✅ Ứng dụng Quản lý Nhân sự đang chạy: http://localhost:${PORT}`);
  console.log(`  🔑 Mật khẩu admin: ${ADMIN_PASSWORD}  (đổi bằng biến môi trường ADMIN_PASSWORD)\n`);
});
