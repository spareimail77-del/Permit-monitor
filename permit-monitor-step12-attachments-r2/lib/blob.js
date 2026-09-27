// Single fixed pathname — every upload replaces this same blob,
// so there's always exactly one "current" permit file, never a
// growing list of old uploads to clean up.
export const PERMIT_FILE_PATHNAME = "permit-log/current.xlsm";
