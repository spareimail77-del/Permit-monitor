// The fixed column layout of the "SWWS-PERMITS" sheet in the Excel permit log.
// Rows 1-5 are titles and headers; permit data starts at row 6, columns A..Q.
// If the Excel layout ever changes, this file (and assets/permit-template.xlsx)
// is what to update.

export const SHEET_NAME_PREFIX = "SWWS-PERMITS";
export const FIRST_DATA_ROW = 6;

export const COLUMNS = {
  reference: "B",
  area: "C",
  location: "D",
  permitType: "E",
  jobDescription: "F",
  certificates: "G",
  certificateNo: "H",
  applicant: "I",
  holder: "J",
  issuer: "K",
  areaAuthority: "L",
  controller: "M",
  validFrom: "N",
  validTo: "O",
  excelStatus: "P",
  excelDaysToGo: "Q", // not exported: the column is hidden and left empty
};
