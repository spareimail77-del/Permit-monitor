import { head } from "@vercel/blob";
import * as XLSX from "xlsx";
import { PERMIT_FILE_PATHNAME } from "./blob";
import { SHEET_NAME_PREFIX, FIRST_DATA_ROW, COLUMNS } from "./permitColumns";

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

function cellValue(sheet, col, row) {
  const cell = sheet[`${col}${row}`];
  return cell ? cell.v : null;
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

  let arrayBuffer;
  try {
    // The blob lives at a fixed pathname that gets overwritten on every
    // upload (so there's always exactly one "current" file). Vercel's
    // CDN can keep serving the previous file's bytes for a while after
    // an overwrite, so we bust the cache with the blob's own uploadedAt
    // timestamp — it changes on every upload, forcing a fresh fetch.
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

  return {
    uploadedAt: blobInfo.uploadedAt,
    permits,
    duplicateReferences,
  };
}
