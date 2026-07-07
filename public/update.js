// Cổng tự cập nhật cho nhân sự (công khai, song ngữ Việt–Anh).
import { t, getLang, setLang, flabel } from '/i18n.js';

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
const TOKEN = location.pathname.split('/update/')[1] || '';
let CAMPAIGN = null;
let STEP = { name: 'lookup', creds: null, data: null, changed: 0 };

// Nút chuyển ngôn ngữ
$('#langToggle').addEventListener('click', () => {
  setLang(getLang() === 'vi' ? 'en' : 'vi');
  applyChrome();
  rerender();
});
function applyChrome() {
  $('#langToggle').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  $('#brandbar').textContent = t('pub_brand');
}

async function load() {
  applyChrome();
  try {
    CAMPAIGN = await (await fetch('/api/public/campaign/' + encodeURIComponent(TOKEN))).json();
  } catch { return fail(t('pub_conn_err')); }
  if (CAMPAIGN.error) return fail(CAMPAIGN.error);
  if (!CAMPAIGN.valid) { $('#title').textContent = CAMPAIGN.title; return fail(CAMPAIGN.reason || t('pub_link_dead')); }
  rerender();
}

function rerender() {
  if (!CAMPAIGN) return;
  $('#title').textContent = CAMPAIGN.title;
  if (STEP.name === 'lookup') showLookup();
  else if (STEP.name === 'edit') showEditForm(STEP.creds, STEP.data);
  else if (STEP.name === 'success') showSuccess(STEP.changed);
}

function fail(msg) {
  $('#title').textContent = t('pub_unavailable');
  $('#subtitle').textContent = '';
  $('#body').replaceChildren(el('div', { className: 'note', style: 'background:#fef2f2;border-color:#fecaca;color:#991b1b' }, '⚠️ ' + msg));
}

// Bước 1: xác thực danh tính
function showLookup() {
  STEP = { name: 'lookup', creds: null, data: null, changed: 0 };
  $('#subtitle').textContent = t('pub_verify_sub');
  const form = el('form', { className: 'stack' });
  form.append(
    el('div', { className: 'note' }, t('pub_note_verify')),
    labeled(t('pub_code'), el('input', { name: 'employee_code', required: true, placeholder: t('pub_code_ph') })),
  );
  if (CAMPAIGN.require_dob) form.append(labeled(t('pub_dob'), el('input', { type: 'date', name: 'date_of_birth', required: true })));
  const err = el('p', { style: 'color:var(--danger);font-size:13px;margin:0' });
  const btn = el('button', { className: 'btn primary block', type: 'submit' }, t('pub_continue'));
  form.append(err, btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = t('pub_checking'); err.textContent = '';
    const creds = { employee_code: form.employee_code.value.trim(), date_of_birth: form.date_of_birth?.value || '' };
    try {
      const r = await postJson('/api/public/campaign/' + encodeURIComponent(TOKEN) + '/lookup', creds);
      if (r.error) throw new Error(r.error);
      STEP = { name: 'edit', creds, data: r, changed: 0 };
      showEditForm(creds, r);
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = t('pub_continue'); }
  });
  $('#body').replaceChildren(form);
}

// Bước 2: chỉnh sửa các trường được phép
function showEditForm(creds, data) {
  $('#subtitle').textContent = t('pub_edit_sub');
  const form = el('form', { className: 'stack' });
  form.append(el('div', { className: 'note' }, t('pub_greeting', data.full_name, data.employee_code)));

  for (const f of CAMPAIGN.fields) form.append(labeled(flabel(f), fieldControl(f, data.values[f.key])));

  const err = el('p', { style: 'color:var(--danger);font-size:13px;margin:0' });
  const btn = el('button', { className: 'btn primary block', type: 'submit' }, t('pub_save'));
  form.append(err, btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = t('pub_saving'); err.textContent = '';
    const values = {};
    for (const inp of form.querySelectorAll('[name]')) if (inp.name.startsWith('f_')) values[inp.name.slice(2)] = inp.value;
    try {
      const r = await postJson('/api/public/campaign/' + encodeURIComponent(TOKEN) + '/submit', { ...creds, values });
      if (r.error) throw new Error(r.error);
      STEP = { name: 'success', creds: null, data: null, changed: r.changed };
      showSuccess(r.changed);
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = t('pub_save'); }
  });
  $('#body').replaceChildren(form);
}

function showSuccess(changed) {
  $('#subtitle').textContent = '';
  $('#body').replaceChildren(el('div', { className: 'success' },
    el('div', { className: 'ico' }, '✅'),
    el('h2', {}, t('pub_success_title')),
    el('p', { style: 'color:var(--muted)' }, changed ? t('pub_success_msg', changed) : t('pub_success_none')),
    (() => { const b = el('button', { className: 'btn' }, t('pub_another')); b.onclick = showLookup; return b; })(),
  ));
}

// Helpers
function fieldControl(f, value) {
  if (f.type === 'select') {
    const input = el('select', { name: 'f_' + f.key });
    input.append(el('option', { value: '' }, t('select_ph')));
    for (const o of f.options) input.append(el('option', { value: o, selected: value === o }, o));
    return input;
  }
  if (f.type === 'textarea') return el('textarea', { name: 'f_' + f.key, value: esc(value) });
  if (f.type === 'datalist') {
    const listId = 'dl_' + f.key;
    const wrap = el('span');
    const input = el('input', { name: 'f_' + f.key, value: esc(value), list: listId, autocomplete: 'off', placeholder: t('datalist_ph') });
    const dl = el('datalist', { id: listId });
    for (const o of f.options) dl.append(el('option', { value: o }));
    wrap.append(input, dl);
    return wrap;
  }
  return el('input', { type: f.type === 'number' ? 'number' : f.type, name: 'f_' + f.key, value: esc(value) });
}
function labeled(label, control) { return el('label', { className: 'field' }, el('span', {}, label), control); }
async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

load();
