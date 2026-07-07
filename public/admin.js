// Giao diện quản trị nhân sự (song ngữ Việt–Anh).
import { t, getLang, setLang, flabel, glabel } from '/i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.includes('-') || k === 'list') n.setAttribute(k, v);
    else n[k] = v;
  }
  for (const k of kids.flat()) n.append(k?.nodeType ? k : document.createTextNode(k ?? ''));
  return n;
};
const esc = (s) => (s == null ? '' : String(s));
let TOKEN = localStorage.getItem('hr_token') || '';
let SCHEMA = { groups: [], fields: [] };
let FIELD_BY_KEY = {};
let CURRENT_VIEW = 'employees';

// --- API --------------------------------------------------------------------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error(t('session_expired')); }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || 'Error ' + res.status);
  return data;
}

function toast(msg, kind = '') {
  const el2 = el('div', { className: 'toast ' + kind }, msg);
  $('#toasts').append(el2);
  setTimeout(() => el2.remove(), 3200);
}

// --- Đa ngôn ngữ ------------------------------------------------------------
function applyStaticI18n() {
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  // Nút hiển thị ngôn ngữ SẼ chuyển sang.
  const other = getLang() === 'vi' ? 'English' : 'Tiếng Việt';
  const label = $('#langLabel'); if (label) label.textContent = other;
  const lt = $('#loginLang'); if (lt) lt.textContent = getLang() === 'vi' ? 'EN' : 'VI';
  document.title = t('app_title');
}
function switchLang() {
  setLang(getLang() === 'vi' ? 'en' : 'vi');
  applyStaticI18n();
  render(CURRENT_VIEW);
}

// --- Đăng nhập --------------------------------------------------------------
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function logout() { TOKEN = ''; localStorage.removeItem('hr_token'); showLogin(); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await (await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#loginPassword').value }),
    })).json();
    if (r.token) { TOKEN = r.token; localStorage.setItem('hr_token', TOKEN); start(); }
    else $('#loginErr').textContent = r.error || t('login_wrong');
  } catch { $('#loginErr').textContent = t('login_noconn'); }
});
$('#logoutBtn').addEventListener('click', logout);
$('#langBtn').addEventListener('click', switchLang);
$('#loginLang').addEventListener('click', () => { setLang(getLang() === 'vi' ? 'en' : 'vi'); applyStaticI18n(); });

// --- Điều hướng -------------------------------------------------------------
$('#nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b === btn));
  render(btn.dataset.view);
});

function render(view) {
  CURRENT_VIEW = view;
  $('#viewTitle').textContent = t('title_' + view);
  if (view === 'employees') return renderEmployees();
  if (view === 'campaigns') return renderCampaigns();
  if (view === 'history') return renderHistory();
}

// ===========================================================================
// NHÂN SỰ
// ===========================================================================
let EMPLOYEES = [];
async function renderEmployees(q = '') {
  const content = $('#content');
  EMPLOYEES = await api('/api/employees' + (q ? '?q=' + encodeURIComponent(q) : ''));
  const active = EMPLOYEES.filter((e) => e.status === 'Đang làm việc').length;
  const depts = new Set(EMPLOYEES.map((e) => e.department).filter(Boolean)).size;

  content.replaceChildren(
    el('div', { className: 'stats' },
      stat(EMPLOYEES.length, t('stat_total')),
      stat(active, t('stat_working')),
      stat(EMPLOYEES.length - active, t('stat_off')),
      stat(depts, t('stat_dept')),
    ),
    toolbar(q),
    tableCard(EMPLOYEES),
  );
  const search = $('#searchBox');
  if (search) {
    search.addEventListener('input', debounce((ev) => renderEmployees(ev.target.value), 250));
    if (q) { search.value = q; search.focus(); search.setSelectionRange(q.length, q.length); }
  }
}
function stat(n, l) { return el('div', { className: 'stat' }, el('div', { className: 'n' }, String(n)), el('div', { className: 'l' }, l)); }

function toolbar(q) {
  const bar = el('div', { className: 'toolbar' });
  bar.append(
    el('input', { type: 'search', id: 'searchBox', placeholder: t('search_ph'), value: q }),
    (() => { const b = el('button', { className: 'btn' }, t('import_xlsx')); b.onclick = openImportModal; return b; })(),
    (() => { const b = el('button', { className: 'btn' }, t('export_csv')); b.onclick = exportCsv; return b; })(),
    (() => { const b = el('button', { className: 'btn primary' }, t('add_emp')); b.onclick = () => openEmployeeModal(); return b; })(),
  );
  return bar;
}

function tableCard(rows) {
  if (!rows.length)
    return el('div', { className: 'card' }, el('div', { className: 'empty' }, t('empty_emp')));
  const heads = [t('th_code'), t('th_name'), t('th_dept'), t('th_title'), t('th_position'), t('th_phone'), t('th_status'), ''];
  const thead = el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', {}, h))));
  const tbody = el('tbody');
  for (const r of rows) {
    const actions = el('td', {}, el('div', { className: 'row-actions' },
      iconBtn('✏️', t('edit'), () => openEmployeeModal(r)),
      iconBtn('🗑️', t('del'), () => removeEmployee(r)),
    ));
    tbody.append(el('tr', {},
      el('td', {}, el('code', {}, r.employee_code || '—')),
      el('td', {}, avatar(r.full_name), el('strong', {}, r.full_name || '—')),
      el('td', {}, r.department || '—'),
      el('td', {}, r.job_title || '—'),
      el('td', {}, r.position || '—'),
      el('td', {}, r.phone || '—'),
      el('td', {}, statusBadge(r.status)),
      actions,
    ));
  }
  return el('div', { className: 'card' }, el('div', { className: 'table-wrap' }, el('table', {}, thead, tbody)));
}
function avatar(name) {
  const initials = (name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
  return el('span', { className: 'avatar' }, initials || '?');
}
function statusBadge(s) {
  if (!s) return el('span', {}, '—');
  const cls = s === 'Đang làm việc' ? 'ok' : s === 'Đã nghỉ việc' ? 'off' : 'warn';
  return el('span', { className: 'badge ' + cls }, s);
}
function iconBtn(icon, title, onclick) { const b = el('button', { className: 'btn sm ghost', title }, icon); b.onclick = onclick; return b; }

// --- Modal thêm/sửa ---------------------------------------------------------
function openEmployeeModal(emp) {
  const isEdit = !!emp;
  const form = el('form', { id: 'empForm' });
  for (const g of SCHEMA.groups) {
    const grid = el('div', { className: 'grid2' });
    for (const f of g.fields) grid.append(fieldInput(f, emp?.[f.key], f.type === 'textarea'));
    form.append(el('div', { className: 'form-group' }, el('h3', {}, `${g.icon} ${glabel(g)}`), grid));
  }
  const modal = buildModal(isEdit ? t('modal_edit') : t('modal_add'), form, [
    { label: t('cancel'), className: 'btn', onclick: closeModal },
    { label: isEdit ? t('save_changes') : t('add_new'), className: 'btn primary', submit: true },
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectForm(form);
    try {
      if (isEdit) await api('/api/employees/' + emp.id, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/api/employees', { method: 'POST', body: JSON.stringify(data) });
      closeModal(); toast(isEdit ? t('toast_saved') : t('toast_added'), 'ok');
      renderEmployees($('#searchBox')?.value || '');
    } catch (err) { toast(err.message, 'err'); }
  });
  document.body.append(modal);
}

function fieldInput(f, value = '', full = false) {
  const label = el('label', { className: 'field' + (full ? ' full' : '') });
  label.append(el('span', {}, flabel(f), f.required ? el('span', { className: 'req' }, t('required_mark')) : ''));
  let input, extra;
  if (f.type === 'select') {
    input = el('select', { name: f.key });
    input.append(el('option', { value: '' }, t('select_ph')));
    for (const o of f.options) input.append(el('option', { value: o, selected: value === o }, o));
  } else if (f.type === 'textarea') {
    input = el('textarea', { name: f.key, value: esc(value) });
  } else if (f.type === 'datalist') {
    const listId = 'dl_' + f.key;
    input = el('input', { name: f.key, value: esc(value), list: listId, autocomplete: 'off', placeholder: t('datalist_ph') });
    extra = el('datalist', { id: listId });
    for (const o of f.options) extra.append(el('option', { value: o }));
  } else {
    input = el('input', { type: f.type === 'number' ? 'number' : f.type, name: f.key, value: esc(value) });
  }
  if (f.required) input.required = true;
  label.append(input);
  if (extra) label.append(extra);
  return label;
}
function collectForm(form) {
  const data = {};
  for (const inp of form.querySelectorAll('[name]')) data[inp.name] = inp.value;
  return data;
}

async function removeEmployee(r) {
  if (!confirm(t('confirm_del_emp', r.full_name, r.employee_code))) return;
  try { await api('/api/employees/' + r.id, { method: 'DELETE' }); toast(t('toast_deleted'), 'ok'); renderEmployees($('#searchBox')?.value || ''); }
  catch (err) { toast(err.message, 'err'); }
}

async function exportCsv() {
  const res = await fetch('/api/employees.csv', { headers: { Authorization: 'Bearer ' + TOKEN } });
  const blob = await res.blob();
  const a = el('a', { href: URL.createObjectURL(blob), download: 'nhan-su.csv' });
  document.body.append(a); a.click(); a.remove();
}

// ===========================================================================
// NHẬP TỪ EXCEL / CSV
// ===========================================================================
// Bí danh cột (theo mã cột trong file công ty) → trường hệ thống, giúp tự động ghép.
const IMPORT_ALIASES = {
  maso: 'employee_code', hoten: 'full_name', gianhap: 'hire_date', nghiviec: 'resignation_date',
  trangthai: 'status', phongban: 'department', vitri: 'position', chucdanh: 'job_title',
  jd: 'job_description', congviecphailam: 'job_description', nhomluong: 'salary_type', level: 'level',
  quanly: 'direct_manager', quanlytructiep: 'direct_manager', truongphong: 'head_of_department', truongbophan: 'head_of_department',
  gioitinh: 'gender', ngaysinh: 'date_of_birth', noisinh: 'place_of_birth', bangcap: 'education_level', hocvan: 'education_level',
  thuviec: 'probation_no', thuviectu: 'probation_from', thuviecden: 'probation_to',
  hopdong1: 'contract1_no', hopdong1tu: 'contract1_from', hopdong1den: 'contract1_to',
  hopdong12: 'contract2_no', hopdong2: 'contract2_no', hopdong2tu: 'contract2_from', hopdong2den: 'contract2_to',
  hopdong3: 'contract3_no', hopdong3tu: 'contract3_from', hopdong3den: 'contract3_to',
  loaihdld: 'contract_type', xathuongtru: 'permanent_ward', tinhthuongtru: 'permanent_province', thuongtru: 'permanent_address',
  khuvuc: 'region', newreplace: 'recruitment_type', loaihinhtuyendung: 'recruitment_type',
  email: 'email', sodienthoai: 'phone', dienthoai: 'phone', tentruonghoc: 'school_name', tennganhhoc: 'major',
  msthue: 'tax_code', masothue: 'tax_code', cccd: 'national_id', cmnd: 'national_id',
};
function normKey(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
}
function matchField(text) {
  const n = normKey(text);
  if (!n) return '';
  if (IMPORT_ALIASES[n]) return IMPORT_ALIASES[n];
  for (const f of SCHEMA.fields) if (n === normKey(f.key) || n === normKey(f.label) || n === normKey(f.label_en)) return f.key;
  for (const f of SCHEMA.fields) {
    const a = normKey(f.label), b = normKey(f.label_en);
    if ((a && n.includes(a)) || (b && n.includes(b))) return f.key;
  }
  return '';
}

let IW = null; // trạng thái wizard nhập
function openImportModal() {
  IW = { grid: null, headerRow: 0, mapping: {}, truncated: false };
  const body = el('div', { id: 'impBody' });
  const modal = el('div', { className: 'modal-bg' }, el('div', { className: 'modal wide' },
    el('div', { className: 'modal-head' }, el('h2', {}, t('imp_title')),
      (() => { const x = el('button', { className: 'close-x', type: 'button' }, '×'); x.onclick = closeModal; return x; })()),
    el('div', { className: 'modal-body' }, body)));
  document.body.append(modal);
  renderImportFile();
}

function renderImportFile() {
  const body = $('#impBody');
  const input = el('input', { type: 'file', accept: '.xlsx,.csv' });
  const status = el('p', { className: 'meta' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    status.textContent = t('imp_reading');
    const dataBase64 = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.readAsDataURL(file);
    });
    try {
      const r = await api('/api/import/parse', { method: 'POST', body: JSON.stringify({ filename: file.name, dataBase64 }) });
      IW.grid = r.rows.filter((row) => row.some((c) => String(c).trim() !== ''));
      IW.truncated = r.truncated;
      IW.headerRow = detectHeaderRow(IW.grid);
      autoMap();
      renderImportMap();
    } catch (e) { status.textContent = ''; toast(e.message, 'err'); }
  });
  body.replaceChildren(
    el('p', { className: 'meta', style: 'margin-bottom:12px' }, t('imp_pick_file')),
    input, status,
  );
}

function detectHeaderRow(grid) {
  let best = 0, bestScore = -1;
  const limit = Math.min(grid.length, 12);
  for (let i = 0; i < limit; i++) {
    let s = 0;
    for (const cell of grid[i]) if (matchField(cell)) s++;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}
function autoMap() {
  IW.mapping = {};
  const header = IW.grid[IW.headerRow] || [];
  const used = new Set();
  header.forEach((cell, col) => {
    const key = matchField(cell);
    if (key && !used.has(key)) { IW.mapping[col] = key; used.add(key); }
  });
}

function renderImportMap() {
  const body = $('#impBody');
  const dataRows = IW.grid.slice(IW.headerRow + 1);
  const header = IW.grid[IW.headerRow] || [];
  const width = IW.grid.reduce((w, r) => Math.max(w, r.length), 0);

  // Bộ chọn dòng tiêu đề
  const headerSel = el('select', { style: 'max-width:320px' });
  IW.grid.slice(0, 12).forEach((row, i) => {
    const preview = row.filter((c) => String(c).trim()).slice(0, 4).join(' | ').slice(0, 60);
    headerSel.append(el('option', { value: String(i), selected: i === IW.headerRow }, `#${i + 1}: ${preview || '(trống)'}`));
  });
  headerSel.onchange = () => { IW.headerRow = +headerSel.value; autoMap(); renderImportMap(); };

  const autoBtn = el('button', { className: 'btn sm', type: 'button' }, '✨ ' + t('imp_auto'));
  autoBtn.onclick = () => { autoMap(); renderImportMap(); };

  // Bảng ghép cột
  const tbody = el('tbody');
  for (let col = 0; col < width; col++) {
    const sample = (dataRows.find((r) => String(r[col] ?? '').trim()) || [])[col] || '';
    const sel = el('select');
    sel.append(el('option', { value: '' }, t('imp_ignore')));
    for (const g of SCHEMA.groups) {
      const og = el('optgroup', { label: glabel(g) });
      for (const f of g.fields) og.append(el('option', { value: f.key, selected: IW.mapping[col] === f.key }, flabel(f)));
      sel.append(og);
    }
    sel.onchange = () => { if (sel.value) IW.mapping[col] = sel.value; else delete IW.mapping[col]; };
    tbody.append(el('tr', {},
      el('td', {}, el('strong', {}, header[col] ? String(header[col]).slice(0, 30) : colLetter(col))),
      el('td', { className: 'meta', style: 'max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, String(sample).slice(0, 40)),
      el('td', {}, sel),
    ));
  }
  const table = el('table', { className: 'map-table' },
    el('thead', {}, el('tr', {}, el('th', {}, t('imp_col')), el('th', {}, t('imp_sample')), el('th', {}, t('imp_to_field')))), tbody);

  const foot = el('div', { className: 'modal-foot', style: 'margin:18px -22px -22px' });
  const backBtn = el('button', { className: 'btn', type: 'button' }, t('imp_back')); backBtn.onclick = renderImportFile;
  const doBtn = el('button', { className: 'btn primary', type: 'button' }, t('imp_do')); doBtn.onclick = doImport;
  foot.append(backBtn, doBtn);

  body.replaceChildren(
    IW.truncated ? el('div', { className: 'note-warn' }, '⚠️ ' + t('imp_truncated')) : '',
    el('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:6px' },
      el('label', { className: 'field', style: 'flex:1;min-width:220px' }, el('span', {}, t('imp_header_row')), headerSel), autoBtn),
    el('div', { className: 'meta', style: 'margin-bottom:12px' }, t('imp_rows_found', dataRows.length)),
    el('div', { className: 'map-wrap' }, table),
    foot,
  );
}
function colLetter(n) { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

async function doImport() {
  const dataRows = IW.grid.slice(IW.headerRow + 1);
  const cols = Object.entries(IW.mapping); // [colIndex, fieldKey]
  if (!cols.some(([, k]) => k === 'employee_code')) return toast(t('imp_need_code'), 'err');
  const records = [];
  for (const row of dataRows) {
    const rec = {};
    let any = false;
    for (const [col, key] of cols) {
      const v = row[+col];
      if (v !== undefined && String(v).trim() !== '') { rec[key] = String(v).trim(); any = true; }
    }
    if (any && rec.employee_code) records.push(rec);
  }
  if (!records.length) return toast(t('imp_no_data'), 'err');

  const body = $('#impBody');
  body.replaceChildren(el('p', {}, t('imp_importing')));
  try {
    const r = await api('/api/import/commit', { method: 'POST', body: JSON.stringify({ records }) });
    body.replaceChildren(el('div', { className: 'success', style: 'padding:20px' },
      el('div', { style: 'font-size:44px' }, '✅'),
      el('h2', {}, t('imp_done', r.created, r.updated)),
      r.errors?.length ? el('p', { className: 'meta' }, r.errors.length + ' lỗi bị bỏ qua') : '',
      (() => { const b = el('button', { className: 'btn primary', style: 'margin-top:10px' }, t('imp_close')); b.onclick = () => { closeModal(); renderEmployees(); }; return b; })(),
    ));
  } catch (e) { toast(e.message, 'err'); renderImportMap(); }
}

// ===========================================================================
// CHIẾN DỊCH CẬP NHẬT (SHARE LINK)
// ===========================================================================
async function renderCampaigns() {
  const content = $('#content');
  const campaigns = await api('/api/campaigns');
  const bar = el('div', { className: 'toolbar' });
  const addBtn = el('button', { className: 'btn primary' }, t('camp_create'));
  addBtn.onclick = openCampaignModal;
  bar.append(el('div', { className: 'meta', style: 'flex:1' }, t('camp_intro')), addBtn);

  const list = el('div', { className: 'card' });
  if (!campaigns.length) list.append(el('div', { className: 'empty' }, t('camp_empty')));
  for (const c of campaigns) list.append(campaignCard(c));

  content.replaceChildren(bar, list);
}

function campaignCard(c) {
  const url = location.origin + '/update/' + c.token;
  const expired = c.expires_at && c.expires_at < new Date().toISOString().slice(0, 10);
  const statusEl = expired ? el('span', { className: 'badge warn' }, t('camp_expired'))
    : c.active ? el('span', { className: 'badge ok' }, t('camp_open')) : el('span', { className: 'badge off' }, t('camp_locked'));

  const chips = el('div', { className: 'chips' },
    ...c.allowed_fields.map((k) => el('span', { className: 'chip' }, FIELD_BY_KEY[k] ? flabel(FIELD_BY_KEY[k]) : k)));

  const linkInput = el('input', { value: url, readOnly: true });
  const copyBtn = el('button', { className: 'btn sm' }, t('camp_copy'));
  copyBtn.onclick = () => { navigator.clipboard.writeText(url); toast(t('copied'), 'ok'); };
  const openBtn = el('a', { className: 'btn sm', href: url, target: '_blank' }, t('camp_openlink'));

  const toggleBtn = el('button', { className: 'btn sm' }, c.active ? t('camp_lock') : t('camp_reopen'));
  toggleBtn.onclick = async () => { await api('/api/campaigns/' + c.id, { method: 'PATCH', body: JSON.stringify({ active: !c.active }) }); renderCampaigns(); };
  const delBtn = el('button', { className: 'btn sm danger' }, t('camp_del'));
  delBtn.onclick = async () => { if (confirm(t('confirm_del_camp'))) { await api('/api/campaigns/' + c.id, { method: 'DELETE' }); renderCampaigns(); } };

  return el('div', { className: 'campaign-card' },
    el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
      el('strong', { style: 'font-size:15px' }, c.title), statusEl,
      el('span', { className: 'meta' }, t('camp_subs', c.submissions)),
      el('div', { style: 'flex:1' }), toggleBtn, delBtn),
    el('div', { className: 'meta' },
      t('camp_verify_code') + (c.require_dob ? t('camp_verify_dob') : '') + ' ' + (c.expires_at ? t('camp_expires', c.expires_at) : t('camp_noexpire'))),
    chips,
    el('div', { className: 'link-row' }, linkInput, copyBtn, openBtn),
  );
}

function openCampaignModal() {
  const form = el('form', { id: 'campForm' });
  form.append(
    el('label', { className: 'field' }, el('span', {}, t('camp_field_title'), el('span', { className: 'req' }, ' *')),
      el('input', { name: 'title', required: true, placeholder: t('camp_title_ph') })),
    el('div', { className: 'grid2', style: 'margin-top:14px' },
      el('label', { className: 'field' }, el('span', {}, t('camp_expiry')), el('input', { type: 'date', name: 'expires_at' })),
      el('label', { className: 'field', style: 'display:flex;align-items:center;gap:8px;margin-top:22px' },
        el('input', { type: 'checkbox', name: 'require_dob', checked: true, style: 'width:auto' }),
        el('span', { style: 'margin:0' }, t('camp_require_dob'))),
    ),
    el('div', { style: 'margin-top:18px' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
        el('strong', {}, t('camp_pick')),
        (() => { const b = el('button', { type: 'button', className: 'btn sm ghost' }, t('camp_defaults')); b.onclick = selectDefaults; return b; })()),
      buildFieldPicker()),
  );
  const modal = buildModal(t('campmodal_title'), form, [
    { label: t('cancel'), className: 'btn', onclick: closeModal },
    { label: t('camp_create_btn'), className: 'btn primary', submit: true },
  ], 'wide');

  function selectDefaults() {
    for (const cb of form.querySelectorAll('input[data-key]')) cb.checked = !!FIELD_BY_KEY[cb.dataset.key]?.self;
  }
  selectDefaults();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const allowed = [...form.querySelectorAll('input[data-key]:checked')].map((c) => c.dataset.key);
    const payload = {
      title: form.title.value.trim(),
      allowed_fields: allowed,
      expires_at: form.expires_at.value || null,
      require_dob: form.require_dob.checked,
    };
    try {
      const c = await api('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      toast(t('camp_created'), 'ok');
      renderCampaigns();
      setTimeout(() => { navigator.clipboard?.writeText(location.origin + '/update/' + c.token); }, 100);
    } catch (err) { toast(err.message, 'err'); }
  });
  document.body.append(modal);
}

function buildFieldPicker() {
  const picker = el('div', { className: 'field-picker' });
  for (const g of SCHEMA.groups) {
    picker.append(el('div', { className: 'group-label' }, `${g.icon} ${glabel(g)}`));
    for (const f of g.fields) {
      if (f.key === 'employee_code' || f.key === 'full_name') continue; // dùng để xác thực
      picker.append(el('label', {}, el('input', { type: 'checkbox', 'data-key': f.key }), flabel(f)));
    }
  }
  return picker;
}

// ===========================================================================
// LỊCH SỬ
// ===========================================================================
async function renderHistory() {
  const content = $('#content');
  const rows = await api('/api/self-updates');
  if (!rows.length) return content.replaceChildren(el('div', { className: 'card' }, el('div', { className: 'empty' }, t('hist_empty'))));
  const tbody = el('tbody');
  for (const r of rows) {
    const changeList = Object.entries(r.changes).map(([k, v]) =>
      el('div', { style: 'margin:2px 0' }, el('strong', {}, (FIELD_BY_KEY[k] ? flabel(FIELD_BY_KEY[k]) : k) + ': '),
        el('span', { style: 'color:var(--muted)' }, `${v.from || t('hist_blank')} → `), el('span', { style: 'color:var(--ok)' }, v.to || t('hist_blank'))));
    tbody.append(el('tr', {},
      el('td', {}, new Date(r.submitted_at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'vi-VN')),
      el('td', {}, el('code', {}, r.employee_code), el('div', {}, r.full_name)),
      el('td', {}, changeList.length ? changeList : el('span', { className: 'meta' }, t('hist_nochange'))),
    ));
  }
  content.replaceChildren(el('div', { className: 'card' }, el('div', { className: 'table-wrap' },
    el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, t('hist_time')), el('th', {}, t('hist_emp')), el('th', {}, t('hist_changes')))), tbody))));
}

// ===========================================================================
// Modal helpers
// ===========================================================================
function buildModal(title, body, buttons, extraClass = '') {
  const foot = el('div', { className: 'modal-foot' });
  for (const b of buttons) {
    const btn = el('button', { className: b.className, type: b.submit ? 'submit' : 'button' }, b.label);
    if (b.onclick) btn.onclick = b.onclick;
    if (b.submit) foot.append(btn); else foot.prepend(btn);
  }
  const x = el('button', { className: 'close-x', type: 'button' }, '×'); x.onclick = closeModal;
  const modal = el('div', { className: 'modal ' + extraClass },
    el('div', { className: 'modal-head' }, el('h2', {}, title), x),
    el('div', { className: 'modal-body' }, body));
  if (body.tagName === 'FORM') body.append(foot); else modal.append(foot);
  const bg = el('div', { className: 'modal-bg' }, modal);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  return bg;
}
function closeModal() { document.querySelector('.modal-bg')?.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function debounce(fn, ms) { let tt; return (...a) => { clearTimeout(tt); tt = setTimeout(() => fn(...a), ms); }; }

// ===========================================================================
async function start() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  applyStaticI18n();
  SCHEMA = await api('/api/fields');
  FIELD_BY_KEY = Object.fromEntries(SCHEMA.fields.map((f) => [f.key, f]));
  render('employees');
}

// Khởi động
applyStaticI18n();
(async () => {
  if (!TOKEN) return showLogin();
  try { await api('/api/employees'); start(); } catch { showLogin(); }
})();
