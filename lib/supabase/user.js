// Who is signed in? Returns { id } or null.
//
// getClaims() checks the session token on the server itself when the Supabase
// project signs tokens with asymmetric keys (the default for newer projects),
// so it costs no network round trip. If the project still uses the older
// shared-secret signing, Supabase quietly falls back to asking the Auth
// server, i.e. exactly what getUser() always did. Either way an expired token
// is refreshed first.
//
// Used by middleware and for read-only page loads. Anything that changes data
// (API routes that write) keeps calling getUser(), which also confirms the
// session has not been revoked.
export async function getCurrentUser(supabase) {
  if (typeof supabase.auth.getClaims === "function") {
    try {
      const { data } = await supabase.auth.getClaims();
      const id = data?.claims?.sub;
      return id ? { id } : null;
    } catch (err) {
      return null;
    }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}
