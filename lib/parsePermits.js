import { head } from "@vercel/blob";
import * as XLSX from "xlsx";
import { PERMIT_FILE_PATHNAME } from "./blob";
import {
  SHEET_NAME_PREFIX,
  FIRST_DATA_ROW,
  COLUMNS,
  EXPORT_COLUMN_COUNT,
  EXPORT_MARKER,
} from "./permitColumns";

// Excel stores dates as timezone-less calendar dates (a "day", not an
// instant). We read the calendar components straight off the parsed
// date rather than converting timezones, so "30 Sep" in Excel is
// always "30 Sep" here, regardless of server timezone.
function excelDateToISODate(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


// Copies the sheet's title/header rows (1..5, columns A..Q), merges and
// column widths as plain JSON. The Export button uses this so an exported
// file has the same header block as the master log. Cheap: 5 rows only.
function extractTemplate(sheet, sheetName) {
  const rows = [];
  for (let r = 0; r < FIRST_DATA_ROW - 1; r++) {
    const line = [];
    for (let c = 0; c < EXPORT_COLUMN_COUNT; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v == null) {
        line.push(null);
      } else if (cell.t === "n" || cell.t === "s" || cell.t === "b") {
        line.push(cell.v);
      } else if (cell.v instanceof Date) {
        line.push(excelDateToISODate(cell.v));
      } else {
        line.push(cell.w != null ? String(cell.w) : String(cell.v));
      }
    }
    rows.push(line);
  }

  const lastHeaderRow = FIRST_DATA_ROW - 2;
  const lastCol = EXPORT_COLUMN_COUNT - 1;
  const merges = (sheet["!merges"] || [])
    .filter((m) => m.s.r <= lastHeaderRow && m.s.c <= lastCol)
    .map((m) => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: Math.min(m.e.r, lastHeaderRow), c: Math.min(m.e.c, lastCol) },
    }));

  const cols = [];
  for (let c = 0; c < EXPORT_COLUMN_COUNT; c++) {
    const src = (sheet["!cols"] || [])[c];
    const out = {};
    if (src) {
      if (typeof src.wch === "number") out.wch = src.wch;
      if (typeof src.wpx === "number") out.wpx = src.wpx;
      if (typeof src.width === "number") out.width = src.width;
      if (src.hidden) out.hidden = true;
    }
    cols.push(out);
  }

  return { sheetName, rows, merges, cols };
}

function cellValue(sheet, col, row) {
  const cell = sheet[`${col}${row}`];
  return cell ? cell.v : null;
}

// Downloading and parsing the workbook is the slowest part of loading the
// dashboard, and the file only changes when someone uploads a new one. So
// the parsed result is kept in memory (per server instance) and reused for
// as long as the blob's uploadedAt stamp is unchanged. The cheap `head()`
// check still runs on every call, so a new upload shows up immediately -
// the cache can never serve an old file. Failures are never kept.
let cachedPermitData = null; // { key, promise }

async function loadPermitData(blobInfo) {
  let arrayBuffer;
  try {
    // The blob lives at a fixed pathname that gets overwritten on every
    // upload (so there's always exactly one "current" file). Vercel's
    // CDN can keep serving the previous file's bytes for a while after
    // an overwrite, so we bust the cache with the blob's own uploadedAt
    // timestamp - it changes on every upload, forcing a fresh fetch.
    const cacheBustedUrl = `${blobInfo.url}?v=${new Date(
      blobInfo.uploadedAt
    ).getTime()}`;
    const res = await fetch(cacheBustedUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    arrayBuffer = await res.arrayBuffer();
  } catch (err) {
    return {
      error: "FETCH_FAILED",
      message: "Could not retrieve the stored file.",
    };
  }

  const parsed = parsePermitsFromBuffer(arrayBuffer);
  if (parsed.error) return parsed;

  return {
    uploadedAt: blobInfo.uploadedAt,
    permits: parsed.permits,
    duplicateReferences: parsed.duplicateReferences,
    template: parsed.template,
  };
}

export async function fetchPermitData() {
  let blobInfo;
  try {
    blobInfo = await head(PERMIT_FILE_PATHNAME);
  } catch (err) {
    return {
      error: "NO_FILE",
      message: "No permit file has been uploaded yet.",
    };
  }

  const key = `${blobInfo.url}|${new Date(blobInfo.uploadedAt).getTime()}`;

  if (cachedPermitData && cachedPermitData.key === key) {
    const result = await cachedPermitData.promise;
    if (!result.error) return result;
    // The shared attempt failed - fall through and try again.
  }

  const promise = loadPermitData(blobInfo);
  cachedPermitData = { key, promise };
  const result = await promise;
  if (result.error && cachedPermitData && cachedPermitData.promise === promise) {
    cachedPermitData = null;
  }
  return result;
}

// Parses an Excel file (as an ArrayBuffer) into permit rows. Shared by
// the dashboard reader below and by the upload route, which uses it to
// compare the old file against the new one.
export function parsePermitsFromBuffer(arrayBuffer) {
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  } catch (err) {
    return {
      error: "PARSE_FAILED",
      message: "The uploaded file could not be read as an Excel workbook.",
    };
  }

  const sheetName =
    workbook.SheetNames.find((n) => n.startsWith(SHEET_NAME_PREFIX)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return {
      error: "SHEET_NOT_FOUND",
      message: `Could not find a sheet named like "${SHEET_NAME_PREFIX}...".`,
    };
  }

  const permits = [];
  let row = FIRST_DATA_ROW;
  let consecutiveEmpty = 0;

  // Stop after 3 consecutive blank reference cells — tolerates a
  // single stray blank row without reading indefinitely past the
  // end of the real data.
  while (consecutiveEmpty < 3) {
    const rawRef = cellValue(sheet, COLUMNS.reference, row);
    const reference = rawRef != null ? String(rawRef).trim() : "";

    if (!reference) {
      consecutiveEmpty++;
      row++;
      continue;
    }
    consecutiveEmpty = 0;

    const get = (col) => cellValue(sheet, col, row);
    const str = (col) => {
      const v = get(col);
      return v != null ? String(v).trim() : "";
    };

    permits.push({
      rowNumber: row,
      reference,
      area: str(COLUMNS.area),
      location: str(COLUMNS.location),
      permitType: str(COLUMNS.permitType),
      jobDescription: str(COLUMNS.jobDescription),
      certificates: str(COLUMNS.certificates),
      certificateNo: str(COLUMNS.certificateNo),
      applicant: str(COLUMNS.applicant),
      holder: str(COLUMNS.holder),
      issuer: str(COLUMNS.issuer),
      areaAuthority: str(COLUMNS.areaAuthority),
      controller: str(COLUMNS.controller),
      validFrom: excelDateToISODate(get(COLUMNS.validFrom)),
      validTo: excelDateToISODate(get(COLUMNS.validTo)),
      excelStatus: str(COLUMNS.excelStatus).toUpperCase(),
      excelDaysToGo: str(COLUMNS.excelDaysToGo),
    });

    row++;
  }

  const referenceCounts = {};
  for (const p of permits) {
    referenceCounts[p.reference] = (referenceCounts[p.reference] || 0) + 1;
  }
  const duplicateReferences = Object.keys(referenceCounts).filter(
    (ref) => referenceCounts[ref] > 1
  );

  // Files produced by the Export button carry a marker in their file
  // properties. The upload route uses this to refuse them, because an
  // export can be filtered and would archive every permit it leaves out.
  const props = workbook.Props || {};
  const isExport = [props.Keywords, props.Subject].some(
    (v) => typeof v === "string" && v.includes(EXPORT_MARKER)
  );

  return {
    permits,
    duplicateReferences,
    isExport,
    template: extractTemplate(sheet, sheetName),
  };
}
