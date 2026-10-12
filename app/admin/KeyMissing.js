export default function KeyMissing() {
  return (
    <div className="notice notice--danger">
      The server cannot reach the admin functions: <span className="mono">SUPABASE_SERVICE_ROLE_KEY</span> is not set. In
      Vercel → Project → Settings → Environment Variables add it (Supabase → Project Settings → API → service_role), then
      redeploy.
    </div>
  );
}
