// Form ứng tuyển thực tập sinh (công khai, song ngữ Việt–Anh).
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
let FIELDS = [];
let STATE = 'form'; // form | success

$('#langToggle').addEventListener('click', () => {
  setLang(getLang() === 'vi' ? 'en' : 'vi');
  applyChrome();
  if (STATE === 'form') showForm(); else showSuccess();
});
function applyChrome() {
  $('#langToggle').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  $('#title').textContent = t('apply_title');
  $('#brandbar').textContent = t('pub_brand');
}

async function load() {
  applyChrome();
  $('#subtitle').textContent = t('apply_sub');
  try {
    const schema = await (await fetch('/api/intern-fields')).json();
    FIELDS = schema.fields.filter((f) => f.apply);
  } catch { $('#body').replaceChildren(el('div', { className: 'note', style: 'background:#fef2f2;border-color:#fecaca;color:#991b1b' }, '⚠️ ' + t('apply_conn_err'))); return; }
  showForm();
}

function showForm() {
  STATE = 'form';
  $('#subtitle').textContent = t('apply_sub');
  const form = el('form', { className: 'stack' });
  for (const f of FIELDS) form.append(labeled(f, fieldControl(f)));
  const err = el('p', { style: 'color:var(--danger);font-size:13px;margin:0' });
  const btn = el('button', { className: 'btn primary block', type: 'submit' }, t('apply_submit'));
  form.append(err, btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = t('apply_submitting'); err.textContent = '';
    const values = {};
    for (const inp of form.querySelectorAll('[name]')) if (inp.name.startsWith('f_')) values[inp.name.slice(2)] = inp.value;
    try {
      const res = await fetch('/api/public/intern-apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }),
      });
      const r = await res.json();
      if (r.error) throw new Error(r.error);
      showSuccess();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = t('apply_submit'); }
  });
  $('#body').replaceChildren(form);
}

function showSuccess() {
  STATE = 'success';
  $('#subtitle').textContent = '';
  $('#body').replaceChildren(el('div', { className: 'success' },
    el('div', { className: 'ico' }, '✅'),
    el('h2', {}, t('apply_success_title')),
    el('p', { style: 'color:var(--muted)' }, t('apply_success_msg')),
    (() => { const b = el('button', { className: 'btn' }, t('apply_another')); b.onclick = showForm; return b; })(),
  ));
}

function fieldControl(f) {
  if (f.type === 'select') {
    const input = el('select', { name: 'f_' + f.key });
    input.append(el('option', { value: '' }, t('select_ph')));
    for (const o of f.options) input.append(el('option', { value: o }, o));
    if (f.required) input.required = true;
    return input;
  }
  if (f.type === 'textarea') return el('textarea', { name: 'f_' + f.key });
  if (f.type === 'datalist') {
    const listId = 'dl_' + f.key;
    const wrap = el('span');
    const input = el('input', { name: 'f_' + f.key, list: listId, autocomplete: 'off', placeholder: t('datalist_ph') });
    if (f.required) input.required = true;
    const dl = el('datalist', { id: listId });
    for (const o of f.options) dl.append(el('option', { value: o }));
    wrap.append(input, dl);
    return wrap;
  }
  const input = el('input', { type: f.type === 'number' ? 'number' : f.type, name: 'f_' + f.key });
  if (f.required) input.required = true;
  return input;
}
function labeled(f, control) {
  return el('label', { className: 'field' }, el('span', {}, flabel(f), f.required ? el('span', { style: 'color:var(--danger)' }, ' *') : ''), control);
}

load();
