// Limits for the public forms. Server only; takes the admin client.

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

// true = allowed. If the check itself fails, the request is allowed (the forms
// have their own caps), and the problem is logged.
export async function allowed(admin, bucket, max, windowSeconds) {
  const { data, error } = await admin.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate limit check failed:", error);
    return true;
  }
  return data !== false;
}
