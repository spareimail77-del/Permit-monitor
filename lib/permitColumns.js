// Maps the fixed column layout of the "SWWS-PERMITS" sheet.
// Rows 1-5 are titles/headers; permit data starts at row 6.
// If the sheet layout ever changes, this is the only file to edit.

export const SHEET_NAME_PREFIX = "SWWS-PERMITS";
export const FIRST_DATA_ROW = 6;

export const COLUMNS = {
  reference: "B",
  area: "C",
  location: "D",
  permitType: "E",
  certificates: "G",
  certificateNo: "H",
  jobDescription: "F",
  applicant: "I",
  holder: "J",
  issuer: "K",
  areaAuthority: "L",
  controller: "M",
  validFrom: "N",
  validTo: "O",
  excelStatus: "P",
  excelDaysToGo: "Q",
};

// Excel exports are always written A..Q (17 columns) and carry this
// marker in the file properties, so the upload route can refuse an
// exported (possibly filtered) file being uploaded as the master log.
export const EXPORT_COLUMN_COUNT = 17;
export const EXPORT_MARKER = "PERMIT-MONITOR-EXPORT";
