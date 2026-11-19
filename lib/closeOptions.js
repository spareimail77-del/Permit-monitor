// The names the "check before closing" popup offers for Holder and Issuer: the same
// active values as the permit form's dropdowns (permit_options), so people can only pick
// names that already exist. New names are added on the Lists page.
//
// Server side. Returns { holder: [...], issuer: [...] }, or null when the lists could not
// be read (the popup then shows the empty fields but cannot fill them in).
export async function fetchCloseOptions(supabase) {
  const { data, error } = await supabase
    .from("permit_options")
    .select("list, value")
    .in("list", ["holder", "issuer"])
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("value", { ascending: true })
    .limit(1000);
  if (error) {
    console.error("Reading the holder / issuer lists failed:", error);
    return null;
  }
  const lists = { holder: [], issuer: [] };
  for (const o of data || []) if (lists[o.list]) lists[o.list].push(o.value);
  return lists;
}
