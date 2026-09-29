// Builds an .xlsx download in the browser (nothing is generated on the
// server). The sheet uses the same layout as the master permit log:
// header block in rows 1-5, permit data from row 6, columns A..Q at the
// same positions the upload parser reads. No macros/VBA are included.
//
// The `xlsx` library is loaded only when someone clicks Export, so it
// adds nothing to normal page loads.

import {
  COLUMNS,
  FIRST_DATA_ROW,
  SHEET_NAME_PREFIX,
  EXPORT_COLUMN_COUNT,
  EXPORT_MARKER,
} from "./permitColumns";
import { computeDisplayStatus } from "./status";
import { normalizeStatus } from "./statusMeta";

const DATE_FORMAT = "dd-mmm-yyyy";

const FALLBACK_LABELS = [
  "",
  "Permit No.",
  "Area",
  "Location",
  "Permit Type",
  "Job Description",
  "Certificates",
  "Certificate No.",
  "Applicant",
  "Holder",
  "Issuer",
  "Area Authority",
  "Controller",
  "Valid From",
  "Valid To",
  "Status",
  "Days To Go",
];

function colIndex(letter) {
  return letter.charCodeAt(0) - 65; // "A" -> 0 ... "Q" -> 16
}

// "2026-09-30" -> Excel serial number (whole days, no timezone maths).
export function isoToExcelSerial(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

// Status text as the site shows it. EXPIRING_SOON -> "EXPIRING SOON".
export function statusToText(status) {
  return String(status || "").replace(/_/g, " ");
}

function textCell(value) {
  const v = value == null ? "" : String(value);
  return v === "" ? null : { t: "s", v };
}

function dateCell(iso) {
  const serial = isoToExcelSerial(iso);
  return serial == null ? null : { t: "n", v: serial, z: DATE_FORMAT };
}

function numberCell(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? { t: "n", v: value }
    : null;
}

// permit shape expected here:
// { reference, area, location, permitType, jobDescription, certificates,
//   certificateNo, applicant, holder, issuer, areaAuthority, controller,
//   validFrom, validTo, statusText, days }
export function permitToCells(permit) {
  const cells = {};
  const put = (letter, cell) => {
    if (cell) cells[colIndex(letter)] = cell;
  };
  put(COLUMNS.reference, textCell(permit.reference));
  put(COLUMNS.area, textCell(permit.area));
  put(COLUMNS.location, textCell(permit.location));
  put(COLUMNS.permitType, textCell(permit.permitType));
  put(COLUMNS.jobDescription, textCell(permit.jobDescription));
  put(COLUMNS.certificates, textCell(permit.certificates));
  put(COLUMNS.certificateNo, textCell(permit.certificateNo));
  put(COLUMNS.applicant, textCell(permit.applicant));
  put(COLUMNS.holder, textCell(permit.holder));
  put(COLUMNS.issuer, textCell(permit.issuer));
  put(COLUMNS.areaAuthority, textCell(permit.areaAuthority));
  put(COLUMNS.controller, textCell(permit.controller));
  put(COLUMNS.validFrom, dateCell(permit.validFrom));
  put(COLUMNS.validTo, dateCell(permit.validTo));
  put(COLUMNS.excelStatus, textCell(permit.statusText));
  put(COLUMNS.excelDaysToGo, numberCell(permit.days));
  return cells;
}

function fallbackTemplate() {
  const rows = [];
  for (let r = 0; r < FIRST_DATA_ROW - 1; r++) {
    rows.push(new Array(EXPORT_COLUMN_COUNT).fill(null));
  }
  rows[0][1] = "Permit Log (export)";
  rows[FIRST_DATA_ROW - 2] = FALLBACK_LABELS.map((l) => (l === "" ? null : l));
  return {
    sheetName: SHEET_NAME_PREFIX,
    rows,
    merges: [],
    cols: FALLBACK_LABELS.map(() => ({})),
  };
}

function safeSheetName(name) {
  const cleaned = String(name || SHEET_NAME_PREFIX)
    .replace(/[\[\]:*?/\\]/g, " ")
    .trim();
  return (cleaned || SHEET_NAME_PREFIX).slice(0, 31);
}

// Pure function: returns a plain sheet-like object (cells + metadata)
// so the layout can be checked without the xlsx library.
export function buildSheetModel({ permits, template }) {
  const tpl =
    template && Array.isArray(template.rows) && template.rows.length
      ? template
      : fallbackTemplate();

  const cells = []; // [{ r, c, cell }]
  tpl.rows.slice(0, FIRST_DATA_ROW - 1).forEach((line, r) => {
    (line || []).slice(0, EXPORT_COLUMN_COUNT).forEach((value, c) => {
      if (value == null || value === "") return;
      if (typeof value === "number") cells.push({ r, c, cell: { t: "n", v: value } });
      else if (typeof value === "boolean") cells.push({ r, c, cell: { t: "b", v: value } });
      else cells.push({ r, c, cell: { t: "s", v: String(value) } });
    });
  });

  permits.forEach((permit, i) => {
    const r = FIRST_DATA_ROW - 1 + i; // zero-based row index
    const rowCells = permitToCells(permit);
    Object.entries(rowCells).forEach(([c, cell]) => {
      cells.push({ r, c: Number(c), cell });
    });
  });

  const lastRow = Math.max(FIRST_DATA_ROW - 1 + permits.length, FIRST_DATA_ROW - 1);
  return {
    sheetName: safeSheetName(tpl.sheetName),
    cells,
    merges: Array.isArray(tpl.merges) ? tpl.merges : [],
    cols: Array.isArray(tpl.cols) ? tpl.cols : [],
    lastRow, // zero-based index of the last row in the sheet's range
  };
}

export async function downloadPermitWorkbook({ permits, template, filename }) {
  const mod = await import("xlsx");
  const XLSX = mod.utils ? mod : mod.default;

  const model = buildSheetModel({ permits, template });
  const ws = {};
  for (const { r, c, cell } of model.cells) {
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
  }
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: model.lastRow, c: EXPORT_COLUMN_COUNT - 1 },
  });
  if (model.merges.length) ws["!merges"] = model.merges;
  if (model.cols.length) ws["!cols"] = model.cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, model.sheetName);
  wb.Props = {
    Title: "Permit Log export",
    Subject: EXPORT_MARKER,
    Keywords: EXPORT_MARKER,
    Author: "Permit Monitor",
    Comments:
      "Exported from Permit Monitor. This is not the master log - do not upload it back.",
  };

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------
// Row mappers. Status/days are the site's calculated values (the same
// ones shown on screen), not the raw Excel text.
// ---------------------------------------------------------------

// Permit List row (already carries displayStatus/daysRemaining).
export function listRowToExportPermit(p) {
  return {
    reference: p.reference,
    area: p.area,
    location: p.location,
    permitType: p.permitType,
    jobDescription: p.jobDescription,
    certificates: p.certificates,
    certificateNo: p.certificateNo,
    applicant: p.applicant,
    holder: p.holder,
    issuer: p.issuer,
    areaAuthority: p.areaAuthority,
    controller: p.controller,
    validFrom: p.validFrom,
    validTo: p.validTo,
    statusText: statusToText(p.displayStatus),
    days: p.daysRemaining,
  };
}

// archived_permits row: the full permit lives in `data` (jsonb); the
// plain columns are the fallback for anything missing there.
export function archiveRowToExportPermit(row, todayISO) {
  const d = row.data || {};
  const base = {
    reference: row.reference,
    area: d.area ?? row.area,
    location: d.location ?? row.location,
    permitType: d.permitType ?? row.permit_type,
    jobDescription: d.jobDescription ?? row.job_description,
    certificates: d.certificates,
    certificateNo: d.certificateNo,
    applicant: d.applicant ?? row.applicant,
    holder: d.holder ?? row.holder,
    issuer: d.issuer,
    areaAuthority: d.areaAuthority,
    controller: d.controller,
    validFrom: d.validFrom ?? row.valid_from,
    validTo: d.validTo ?? row.valid_to,
    excelStatus: (d.excelStatus ?? row.excel_status ?? "").toString().toUpperCase(),
  };
  const { displayStatus, daysRemaining } = computeDisplayStatus(base, todayISO);
  return {
    ...base,
    statusText: statusToText(normalizeStatus(displayStatus)),
    days: daysRemaining,
  };
}
