// Form đăng ký tham dự Job Fair (công khai, song ngữ Việt–Anh).
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
let STATE = 'form';

$('#langToggle').addEventListener('click', () => {
  setLang(getLang() === 'vi' ? 'en' : 'vi');
  applyChrome();
  if (STATE === 'form') showForm(); else showSuccess();
});
function applyChrome() {
  $('#langToggle').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  $('#title').textContent = t('jf_apply_title');
  $('#brandbar').textContent = t('pub_brand');
}

async function load() {
  applyChrome();
  $('#subtitle').textContent = t('jf_apply_sub');
  try {
    const schema = await (await fetch('/api/jobfair-fields')).json();
    FIELDS = schema.fields.filter((f) => f.apply);
  } catch { $('#body').replaceChildren(el('div', { className: 'note', style: 'background:#fef2f2;border-color:#fecaca;color:#991b1b' }, '⚠️ ' + t('apply_conn_err'))); return; }
  showForm();
}

function introBlock() {
  const box = el('div', { className: 'intro' },
    el('h3', {}, t('jf_intro_title')),
    el('p', { className: 'welcome' }, t('jf_intro_headline')),
  );
  const body = t('jf_intro_body');
  for (const line of (Array.isArray(body) ? body : [body])) box.append(el('p', {}, line));
  box.append(el('p', { className: 'tagline' }, t('jf_intro_tagline')));
  return box;
}

function showForm() {
  STATE = 'form';
  $('#subtitle').textContent = t('jf_apply_sub');
  const form = el('form', { className: 'stack' });
  form.append(introBlock());
  for (const f of FIELDS) form.append(fieldRow(f));

  // Đính kèm CV (tùy chọn)
  const cvInput = el('input', { type: 'file', name: 'cvfile', accept: '.pdf,.doc,.docx,.png,.jpg,.jpeg' });
  form.append(el('label', { className: 'field' },
    el('span', {}, t('apply_cv_label')), cvInput,
    el('small', { style: 'color:var(--muted);font-size:12px;margin-top:4px;display:block' }, t('apply_cv_hint'))));

  const err = el('p', { style: 'color:var(--danger);font-size:13px;margin:0' });
  const btn = el('button', { className: 'btn primary block', type: 'submit' }, t('apply_submit'));
  form.append(err, btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const values = {};
    for (const inp of form.querySelectorAll('[name]')) {
      if (!inp.name.startsWith('f_')) continue;
      values[inp.name.slice(2)] = inp.type === 'checkbox' ? (inp.checked ? 'Có' : '') : inp.value;
    }
    // Trường chọn nhiều (multiselect) → gộp các lựa chọn đã tick.
    for (const block of form.querySelectorAll('[data-ms]')) {
      values[block.dataset.ms] = [...block.querySelectorAll('input:checked')].map((c) => c.value).join('; ');
    }
    // Kiểm tra multiselect bắt buộc.
    for (const f of FIELDS) if (f.type === 'multiselect' && f.required && !values[f.key]) { err.textContent = t('jf_multi_required'); return; }

    let cv = null;
    const file = cvInput.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { err.textContent = t('apply_cv_toobig'); return; }
      const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
      if (!['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'].includes(ext)) { err.textContent = t('apply_cv_badtype'); return; }
      const dataBase64 = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1]);
        fr.readAsDataURL(file);
      });
      cv = { filename: file.name, mime: file.type, dataBase64 };
    }

    btn.disabled = true; btn.textContent = t('apply_submitting');
    try {
      const res = await fetch('/api/public/jobfair-apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values, cv }),
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

// Một dòng field. Checkbox (đồng ý) và multiselect hiển thị dạng đặc biệt.
function fieldRow(f) {
  if (f.type === 'checkbox') {
    const input = el('input', { type: 'checkbox', name: 'f_' + f.key });
    if (f.required) input.required = true;
    return el('label', { className: 'consent' }, input, el('span', {}, flabel(f), f.required ? ' *' : ''));
  }
  if (f.type === 'multiselect') {
    const block = el('div', { 'data-ms': f.key, className: 'ms-group' });
    for (const o of f.options) block.append(el('label', { className: 'ms-opt' }, el('input', { type: 'checkbox', value: o }), el('span', {}, o)));
    return el('label', { className: 'field' }, el('span', {}, flabel(f), f.required ? el('span', { style: 'color:var(--danger)' }, ' *') : ''), block);
  }
  return el('label', { className: 'field' }, el('span', {}, flabel(f), f.required ? el('span', { style: 'color:var(--danger)' }, ' *') : ''), fieldControl(f));
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

load();
