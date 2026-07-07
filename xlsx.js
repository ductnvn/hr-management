// Bộ đọc file .xlsx tối giản, không phụ thuộc thư viện ngoài.
// .xlsx = archive ZIP chứa XML; ta giải nén bằng node:zlib rồi phân tích XML thủ công.
// Trả về lưới dữ liệu (mảng các hàng, mỗi hàng là mảng chuỗi). Ngày tháng được đổi sang 'YYYY-MM-DD'.
import zlib from 'node:zlib';

// --- Giải nén ZIP qua Central Directory (đáng tin cậy hơn Local Header) -----
function unzip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Tệp không phải định dạng .xlsx hợp lệ');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lhNameLen = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? comp : zlib.inflateRawSync(comp);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// --- Tiện ích XML -----------------------------------------------------------
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
function textOf(xml) {
  // Ghép toàn bộ <t>...</t> bên trong một khối.
  let out = '';
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out += m[1];
  return decodeEntities(out);
}

// --- Shared strings ---------------------------------------------------------
function parseSharedStrings(xml) {
  if (!xml) return [];
  const arr = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) arr.push(textOf(m[1]));
  return arr;
}

// --- Styles: xác định cột nào là ngày ---------------------------------------
const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function parseStyles(xml) {
  if (!xml) return [];
  const numFmts = {};
  let m;
  const nfRe = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  while ((m = nfRe.exec(xml))) numFmts[+m[1]] = decodeEntities(m[2]);
  // cellXfs
  const xfsBlock = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  const isDate = [];
  if (xfsBlock) {
    const xfRe = /<xf\b[^>]*\/?>/g;
    let x;
    while ((x = xfRe.exec(xfsBlock[1]))) {
      const idM = x[0].match(/numFmtId="(\d+)"/);
      const id = idM ? +idM[1] : 0;
      let dateFmt = BUILTIN_DATE_IDS.has(id);
      if (!dateFmt && numFmts[id]) {
        const code = numFmts[id].replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
        dateFmt = /[ymd]/i.test(code) && !/[#]/.test(code);
      }
      isDate.push(dateFmt);
    }
  }
  return isDate;
}

// --- Chuyển số serial của Excel sang ngày -----------------------------------
function excelSerialToISO(serial) {
  const n = Number(serial);
  if (!isFinite(n) || n <= 0) return '';
  const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = số ngày 1899-12-30 → 1970-01-01
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function colToIndex(ref) {
  const s = (ref.match(/^[A-Z]+/) || ['A'])[0];
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// --- Phân tích một worksheet ------------------------------------------------
function parseSheet(xml, shared, isDateStyle) {
  const rows = [];
  const rowRe = /<row\b[^>]*\/>|<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const inner = rm[1];
    const row = [];
    if (inner) {
      const cellRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
      let cm;
      while ((cm = cellRe.exec(inner))) {
        const attrs = cm[1] || cm[2] || '';
        const body = cm[3] || '';
        const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
        const t = (attrs.match(/t="([^"]+)"/) || [])[1];
        const sIdx = (attrs.match(/s="(\d+)"/) || [])[1];
        const idx = ref ? colToIndex(ref) : row.length;
        let val = '';
        if (t === 's') {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          val = v != null ? (shared[+v] ?? '') : '';
        } else if (t === 'inlineStr') {
          val = textOf(body);
        } else if (t === 'str' || t === 'b') {
          val = decodeEntities((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '');
        } else {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (v != null && v !== '') {
            if (sIdx != null && isDateStyle[+sIdx]) val = excelSerialToISO(v);
            else val = String(v);
          }
        }
        while (row.length < idx) row.push('');
        row[idx] = val;
      }
    }
    rows.push(row);
  }
  // Chuẩn hóa độ dài các hàng.
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  for (const r of rows) while (r.length < width) r.push('');
  return rows;
}

function pickFirstSheetPath(files) {
  const wb = files['xl/workbook.xml'] ? files['xl/workbook.xml'].toString('utf8') : '';
  const rels = files['xl/_rels/workbook.xml.rels'] ? files['xl/_rels/workbook.xml.rels'].toString('utf8') : '';
  const firstSheet = wb.match(/<sheet\b[^>]*\/>/);
  if (firstSheet) {
    const rid = (firstSheet[0].match(/r:id="([^"]+)"/) || [])[1];
    if (rid) {
      const rel = rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`));
      const target = rel && (rel[0].match(/Target="([^"]+)"/) || [])[1];
      if (target) {
        const clean = target.replace(/^\/?xl\//, '').replace(/^\//, '');
        if (files['xl/' + clean]) return 'xl/' + clean;
        if (files[target.replace(/^\//, '')]) return target.replace(/^\//, '');
      }
    }
  }
  const sheetKeys = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  return sheetKeys[0];
}

// --- API chính --------------------------------------------------------------
export function parseXlsx(buf) {
  const files = unzip(buf);
  const shared = parseSharedStrings(files['xl/sharedStrings.xml']?.toString('utf8'));
  const isDateStyle = parseStyles(files['xl/styles.xml']?.toString('utf8'));
  const sheetPath = pickFirstSheetPath(files);
  if (!sheetPath || !files[sheetPath]) throw new Error('Không tìm thấy sheet dữ liệu trong tệp');
  const rows = parseSheet(files[sheetPath].toString('utf8'), shared, isDateStyle);
  return { sheet: sheetPath.split('/').pop(), rows };
}

// --- Phân tích CSV ----------------------------------------------------------
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r') { /* bỏ qua */ }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  for (const r of rows) while (r.length < width) r.push('');
  return { sheet: 'CSV', rows };
}
