// Database-backed rate limiting for the public forms. Serverless
// functions don't share memory, so hits are recorded in the small
// rate_limits table (service key only). Old rows are pruned now and then.

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : "unknown").slice(0, 64);
}

// Returns true when `key` already has `limit` hits inside the window;
// otherwise records this hit and returns false.
export async function isRateLimited(admin, key, limit, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const { count } = await admin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", key)
    .gte("created_at", since);
  if ((count || 0) >= limit) return true;

  await admin.from("rate_limits").insert({ bucket: key });

  if (Math.random() < 0.05) {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString();
    await admin.from("rate_limits").delete().lt("created_at", old);
  }
  return false;
}
