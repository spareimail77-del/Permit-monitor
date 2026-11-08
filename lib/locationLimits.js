// ONE place for the Location limits. The browser (picker + form) and the server
// (the real check) both import these, so they can never disagree again.
//
// To allow more or fewer locations per permit, change MAX_LOCATIONS here. Nothing else.

// How many locations one permit may have.
export const MAX_LOCATIONS = 30;

// The saved text ("A, B & C") may be this long. Must fit MAX_LOCATIONS of the longest
// location names. 30 x ~12 characters is ~400, so 1000 leaves plenty of room.
// (The database column is plain `text`, so it needs no change.)
export const MAX_LOCATION_TEXT = 1000;

// Safety net: a request carrying more picks than this is refused outright, before any
// matching work is done (stops a broken or hostile client sending thousands of names).
export const MAX_RAW_PICKS = MAX_LOCATIONS * 4;
