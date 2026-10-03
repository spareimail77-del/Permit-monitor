// Fills a copy of the real master permit log with the permits to export,
// inside the browser. Everything that makes the log look right (logos,
// fonts, merged headings, column widths, row heights, colour rules, the
// dropdown lists) is left exactly as it is in the master file; only the
// permit rows (row 6 downwards) are rewritten.
//
// An .xlsx file is a zip of XML files, so this works on that XML directly
// (JSZip opens and closes the zip). Macros and the hidden ActiveX control
// of the .xlsm are removed, so the result is a clean .xlsx.
//
// transformMasterZip() is a plain function (no browser needed) so it can
// be checked on a real file; buildFilledWorkbook() is what the Export
// button calls.

import {
  COLUMNS,
  FIRST_DATA_ROW,
  SHEET_NAME_PREFIX,
  EXPORT_MARKER,
} from "./permitColumns";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAIN_CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const ROW_HEIGHT = 40.5; // the master's normal permit row height
const LINE_HEIGHT = 20.25;

const SL_COLUMN = "A";

// ---------- small helpers ----------

function xmlEscape(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Excel's own line break is a single "\n". The log's text can hold doubled
// breaks (\r\r\n), which show up as blank lines, so they are tidied here.
function cleanText(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\r\n|\r|\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function colNumber(letter) {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// Excel wants the cells of a row in column order (A, B, C ...), so the list
// is sorted rather than trusting the order of the COLUMNS settings.
const DATA_COLUMNS = Object.values(COLUMNS).sort((a, b) => colNumber(a) - colNumber(b)); // B..Q

function isoToSerial(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

// ---------- reading the template ----------

// For every cell style: is it a solid fill (e.g. the yellow "missing" mark),
// and does it wrap text?
function readStyleInfo(stylesXml) {
  const fillsBlock = /<fills[^>]*>([\s\S]*?)<\/fills>/.exec(stylesXml);
  const fills = fillsBlock ? fillsBlock[1].match(/<fill>[\s\S]*?<\/fill>|<fill\/>/g) || [] : [];
  const xfsBlock = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  const xfs = xfsBlock
    ? xfsBlock[1].match(/<xf\b[^>]*?\/>|<xf\b[^>]*?>[\s\S]*?<\/xf>/g) || []
    : [];
  return xfs.map((xf) => {
    const fillId = Number(attr(xf, "fillId") || 0);
    return {
      solid: /patternType="solid"/.test(fills[fillId] || ""),
      wrap: /wrapText="1"/.test(xf),
    };
  });
}

function readColumnWidths(sheetXml) {
  const widths = {};
  const block = /<cols>([\s\S]*?)<\/cols>/.exec(sheetXml);
  if (!block) return widths;
  for (const m of block[1].matchAll(/<col\b([^>]*?)\/?>/g)) {
    const min = Number(attr(m[1], "min"));
    const max = Number(attr(m[1], "max"));
    const width = Number(attr(m[1], "width"));
    if (min && max && width && max - min < 100) {
      for (let c = min; c <= max; c++) widths[c] = width;
    }
  }
  return widths;
}

function splitSheet(sheetXml) {
  const start = sheetXml.indexOf("<sheetData>");
  const end = sheetXml.indexOf("</sheetData>");
  if (start < 0 || end < 0) throw new Error("sheet has no data section");
  const rows = [];
  const body = sheetXml.slice(start + "<sheetData>".length, end);
  for (const m of body.matchAll(/<row\b([^>]*?)\/>|<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attrs = m[1] != null ? m[1] : m[2];
    rows.push({ r: Number(attr(attrs, "r")), xml: m[0], attrs, inner: m[3] || "" });
  }
  return {
    head: sheetXml.slice(0, start + "<sheetData>".length),
    tail: sheetXml.slice(end),
    rows,
  };
}

function cellsOf(rowInner) {
  const out = [];
  for (const m of rowInner.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    out.push({
      col: m[1],
      attrs: m[3],
      style: attr(m[3], "s"),
      hasValue: m[4] != null && /<v>|<is>|<f[ >]/.test(m[4]),
    });
  }
  return out;
}

// The most common non-highlighted style used in each column of the
// template's own permit rows, so the exported rows look like the master's.
// For text columns a wrapping style is preferred when the template has one,
// so cells with several lines (e.g. two certificate numbers) show every line.
function pickColumnStyles(rows, styleInfo, wrapColumns) {
  const counts = {}; // col -> { styleId: count }
  for (const row of rows) {
    if (row.r < FIRST_DATA_ROW) continue;
    const cells = cellsOf(row.inner);
    if (!cells.some((c) => c.hasValue)) continue;
    for (const c of cells) {
      if (c.style == null) continue;
      if (styleInfo[Number(c.style)]?.solid) continue;
      counts[c.col] = counts[c.col] || {};
      counts[c.col][c.style] = (counts[c.col][c.style] || 0) + 1;
    }
  }
  const picked = {};
  for (const [col, byStyle] of Object.entries(counts)) {
    let entries = Object.entries(byStyle);
    if (wrapColumns.has(col)) {
      const wrapping = entries.filter(([id]) => styleInfo[Number(id)]?.wrap);
      if (wrapping.length) entries = wrapping;
    }
    picked[col] = entries.sort((a, b) => b[1] - a[1])[0][0];
  }
  return picked;
}

// ---------- building the new rows ----------

function textCell(ref, style, value) {
  const s = style != null ? ` s="${style}"` : "";
  if (value == null || value === "") return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function numberCell(ref, style, value) {
  const s = style != null ? ` s="${style}"` : "";
  if (value == null || !Number.isFinite(value)) return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s}><v>${value}</v></c>`;
}

function buildPermitRow(rowNumber, index, permit, styles, styleInfo, widths) {
  const get = (letter) => styles[letter];
  const cells = [];
  cells.push(numberCell(`${SL_COLUMN}${rowNumber}`, get(SL_COLUMN), index + 1));

  const refText = permit.reference == null ? "" : String(permit.reference).trim();
  const refCell = /^[1-9]\d{0,14}$/.test(refText)
    ? numberCell(`${COLUMNS.reference}${rowNumber}`, get(COLUMNS.reference), Number(refText))
    : textCell(`${COLUMNS.reference}${rowNumber}`, get(COLUMNS.reference), refText);
  cells.push(refCell);

  const textFields = [
    ["area", permit.area],
    ["location", permit.location],
    ["permitType", permit.permitType],
    ["jobDescription", permit.jobDescription],
    ["certificates", permit.certificates],
    ["certificateNo", permit.certificateNo],
    ["applicant", permit.applicant],
    ["holder", permit.holder],
    ["issuer", permit.issuer],
    ["areaAuthority", permit.areaAuthority],
    ["controller", permit.controller],
  ];
  const byColumn = {};
  let lines = 1;
  for (const [key, raw] of textFields) {
    const value = cleanText(raw);
    const letter = COLUMNS[key];
    byColumn[letter] = textCell(`${letter}${rowNumber}`, get(letter), value);
    // Rough count of the lines this cell needs, so tall text gets a tall row.
    const info = styleInfo[Number(get(letter))];
    if (value && info?.wrap) {
      const perLine = Math.max(6, Math.floor((widths[colNumber(letter)] || 20) * 0.62));
      const n = String(value)
        .split("\n")
        .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)), 0);
      if (n > lines) lines = n;
    }
  }
  byColumn[COLUMNS.validFrom] = numberCell(
    `${COLUMNS.validFrom}${rowNumber}`,
    get(COLUMNS.validFrom),
    isoToSerial(permit.validFrom)
  );
  byColumn[COLUMNS.validTo] = numberCell(
    `${COLUMNS.validTo}${rowNumber}`,
    get(COLUMNS.validTo),
    isoToSerial(permit.validTo)
  );
  byColumn[COLUMNS.excelStatus] = textCell(
    `${COLUMNS.excelStatus}${rowNumber}`,
    get(COLUMNS.excelStatus),
    permit.statusText
  );
  // "Days to Go" is not exported (the column is hidden): empty, but styled.
  byColumn[COLUMNS.excelDaysToGo] = textCell(
    `${COLUMNS.excelDaysToGo}${rowNumber}`,
    get(COLUMNS.excelDaysToGo),
    ""
  );

  for (const letter of DATA_COLUMNS) if (letter !== COLUMNS.reference) cells.push(byColumn[letter]);

  const height = Math.min(300, Math.max(ROW_HEIGHT, lines * LINE_HEIGHT));
  const first = DATA_COLUMNS.reduce((a, b) => (colNumber(a) < colNumber(b) ? a : b), SL_COLUMN);
  const last = DATA_COLUMNS.reduce((a, b) => (colNumber(a) > colNumber(b) ? a : b), SL_COLUMN);
  return (
    `<row r="${rowNumber}" spans="${colNumber(SL_COLUMN)}:${colNumber(last)}" ht="${height}" customHeight="1">` +
    cells.join("") +
    `</row>`
  );
}

// A template row with its values removed but its formatting kept.
function blankRow(row) {
  const inner = row.inner.replace(
    /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g,
    (m, ref, attrs) => {
      const s = attr(attrs, "s");
      return `<c r="${ref}"${s != null ? ` s="${s}"` : ""}/>`;
    }
  );
  return row.xml.replace(row.inner, inner);
}

// ---------- the zip ----------

function resolvePath(fromFile, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromFile.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relsPathFor(file) {
  const i = file.lastIndexOf("/");
  return `${file.slice(0, i + 1)}_rels/${file.slice(i + 1)}.rels`;
}

async function readText(zip, path) {
  const f = zip.file(path);
  return f ? f.async("string") : null;
}

function relationships(xml) {
  return [...xml.matchAll(/<Relationship\b([^>]*?)\/>/g)].map((m) => ({
    xml: m[0],
    id: attr(m[1], "Id"),
    type: attr(m[1], "Type") || "",
    target: attr(m[1], "Target") || "",
  }));
}

export async function transformMasterZip(zip, permits) {
  // --- find the permit sheet ---
  const workbookXml = await readText(zip, "xl/workbook.xml");
  const workbookRels = await readText(zip, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !workbookRels) throw new Error("not an Excel workbook");

  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*?)\/>/g)].map((m) => ({
    name: attr(m[1], "name") || "",
    rid: attr(m[1], "r:id"),
  }));
  const sheet = sheets.find((s) => s.name.startsWith(SHEET_NAME_PREFIX)) || sheets[0];
  if (!sheet) throw new Error("no sheet found");
  const sheetRel = relationships(workbookRels).find((r) => r.id === sheet.rid);
  if (!sheetRel) throw new Error("sheet file not found");
  const sheetPath = resolvePath("xl/workbook.xml", sheetRel.target);
  let sheetXml = await readText(zip, sheetPath);
  const stylesXml = (await readText(zip, "xl/styles.xml")) || "";
  if (!sheetXml) throw new Error("sheet file is empty");

  // --- rebuild the permit rows ---
  const { head, tail, rows } = splitSheet(sheetXml);
  const styleInfo = readStyleInfo(stylesXml);
  const wrapColumns = new Set(
    [
      "area", "location", "permitType", "jobDescription", "certificates", "certificateNo",
      "applicant", "holder", "issuer", "areaAuthority", "controller",
    ].map((k) => COLUMNS[k])
  );
  const styles = pickColumnStyles(rows, styleInfo, wrapColumns);
  const widths = readColumnWidths(sheetXml);

  const n = permits.length;
  const lastDataRow = Math.max(FIRST_DATA_ROW - 1 + n, FIRST_DATA_ROW);
  const templateByRow = new Map(rows.map((r) => [r.r, r]));
  const lastTemplateRow = rows.length ? Math.max(...rows.map((r) => r.r)) : 0;

  const out = [];
  for (const row of rows) if (row.r < FIRST_DATA_ROW) out.push(row.xml);
  for (let r = FIRST_DATA_ROW; r <= Math.max(lastTemplateRow, FIRST_DATA_ROW - 1 + n); r++) {
    const index = r - FIRST_DATA_ROW;
    if (index < n) out.push(buildPermitRow(r, index, permits[index], styles, styleInfo, widths));
    else if (templateByRow.has(r)) out.push(blankRow(templateByRow.get(r)));
  }

  let newHead = head.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"/, (m, a, b, c) =>
    `<dimension ref="${a}:${b}${Math.max(Number(c), lastDataRow)}"`
  );
  // Hide "Days to Go" (not wanted in the export).
  const dayCol = colNumber(COLUMNS.excelDaysToGo);
  newHead = newHead.replace(
    new RegExp(`<col min="${dayCol}" max="${dayCol}"([^>]*?)(/?)>`),
    (m, rest, slash) => (/hidden=/.test(rest) ? m : `<col min="${dayCol}" max="${dayCol}"${rest} hidden="1"${slash}>`)
  );

  let newTail = tail
    .replace(/(<autoFilter ref="[A-Z]+\d+:[A-Z]+)\d+"/, `$1${lastDataRow}"`)
    .replace(/<sortState\b[\s\S]*?<\/sortState>/, "");

  // --- remove macros and the hidden ActiveX control ---
  const sheetRelsPath = relsPathFor(sheetPath);
  let sheetRelsXml = await readText(zip, sheetRelsPath);
  const removeParts = new Set();
  const removeRelIds = new Set();
  const controlIds = new Set();
  for (const block of [
    /<legacyDrawing\b[^>]*?\/>/.exec(newTail),
    /<controls>[\s\S]*?<\/controls>/.exec(newTail),
  ]) {
    if (block) for (const m of block[0].matchAll(/r:id="([^"]+)"/g)) controlIds.add(m[1]);
  }
  newTail = newTail
    .replace(/<legacyDrawing\b[^>]*?\/>/, "")
    .replace(/<controls>[\s\S]*?<\/controls>/, "");

  if (sheetRelsXml && controlIds.size) {
    for (const rel of relationships(sheetRelsXml)) {
      if (!controlIds.has(rel.id)) continue;
      removeRelIds.add(rel.id);
      const part = resolvePath(sheetPath, rel.target);
      removeParts.add(part);
      // whatever those parts point to (e.g. the control's picture)
      const subRels = await readText(zip, relsPathFor(part));
      if (subRels) {
        removeParts.add(relsPathFor(part));
        for (const sub of relationships(subRels)) removeParts.add(resolvePath(part, sub.target));
      }
    }
    for (const rel of relationships(sheetRelsXml)) {
      if (removeRelIds.has(rel.id)) sheetRelsXml = sheetRelsXml.replace(rel.xml, "");
    }
    zip.file(sheetRelsPath, sheetRelsXml);
  }

  // The macro project and any ActiveX parts.
  let newWorkbookRels = workbookRels;
  for (const rel of relationships(workbookRels)) {
    if (/vbaProject$/.test(rel.type)) {
      newWorkbookRels = newWorkbookRels.replace(rel.xml, "");
      removeParts.add(resolvePath("xl/workbook.xml", rel.target));
    }
  }
  zip.file("xl/_rels/workbook.xml.rels", newWorkbookRels);
  for (const path of Object.keys(zip.files)) {
    if (path.startsWith("xl/activeX/")) removeParts.add(path);
  }

  // Only delete a part if nothing that stays still points at it.
  const stayingRels = [];
  for (const path of Object.keys(zip.files)) {
    if (path.endsWith(".rels") && !removeParts.has(path)) {
      const xml = await readText(zip, path);
      if (xml) stayingRels.push({ path, xml });
    }
  }
  for (const part of removeParts) {
    const stillUsed = stayingRels.some(({ path, xml }) => {
      const owner = path.replace("_rels/", "").replace(/\.rels$/, "");
      return relationships(xml).some((r) => resolvePath(owner, r.target) === part);
    });
    if (!stillUsed) zip.remove(part);
  }

  // --- content types: an .xlsx, and no entries for removed parts ---
  let ct = await readText(zip, "[Content_Types].xml");
  if (ct) {
    ct = ct.replace(
      /(<Override PartName="\/xl\/workbook\.xml" ContentType=")[^"]*"/,
      `$1${MAIN_CT_XLSX}"`
    );
    ct = ct.replace(/<Override\b[^>]*?PartName="([^"]+)"[^>]*?\/>/g, (m, part) =>
      zip.file(part.slice(1)) ? m : ""
    );
    zip.file("[Content_Types].xml", ct);
  }

  // --- print area and filter follow the real last row ---
  let newWorkbook = workbookXml
    .replace(
      /(<definedName name="_xlnm\._FilterDatabase"[^>]*>[^<]*?:\$[A-Z]+\$)\d+(<\/definedName>)/,
      `$1${lastDataRow}$2`
    )
    .replace(
      /(<definedName name="_xlnm\.Print_Area"[^>]*>[^<]*?:\$[A-Z]+\$)(\d+)(<\/definedName>)/,
      (m, a, b, c) => `${a}${Math.max(Number(b), lastDataRow)}${c}`
    );
  zip.file("xl/workbook.xml", newWorkbook);

  // --- mark the file as an export, so the upload page refuses it ---
  let core = await readText(zip, "docProps/core.xml");
  if (core) {
    const put = (xml, tag, text) => {
      const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>|<${tag}/>`);
      return re.test(xml)
        ? xml.replace(re, `<${tag}>${text}</${tag}>`)
        : xml.replace("</cp:coreProperties>", `<${tag}>${text}</${tag}></cp:coreProperties>`);
    };
    core = put(core, "dc:subject", EXPORT_MARKER);
    core = put(core, "cp:keywords", EXPORT_MARKER);
    core = put(
      core,
      "dc:description",
      "Exported from Permit Monitor. This is not the master log - do not upload it back."
    );
    zip.file("docProps/core.xml", core);
  }

  zip.file(sheetPath, `${newHead}${out.join("")}${newTail}`);
  return zip;
}

// What the Export button calls. masterBuffer = the master file's bytes.
export async function buildFilledWorkbook({ masterBuffer, permits }) {
  const mod = await import("jszip");
  const JSZip = mod.default || mod;
  const zip = await JSZip.loadAsync(masterBuffer);
  await transformMasterZip(zip, permits);
  return zip.generateAsync({
    type: "blob",
    mimeType: XLSX_MIME,
    compression: "DEFLATE",
  });
}
