import crypto from "node:crypto";
import { createClient } from "../../../../../lib/supabase/server";
import { getUploadUrl } from "../../../../../lib/r2";
import {
  ATTACHMENT_KIND_VALUES,
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  sanitizeForKey,
} from "../../../../../lib/attachments";

// Middleware already blocks non-admins from reaching /api/admin/*;
// this check runs independently so the lock still holds even if
// middleware config ever changes.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return Response.json(
      { error: "Not authorized. Only HSE admins can add attachments." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { permitReference, kind, fileName, contentType, sizeBytes } = body || {};

  if (!permitReference || !fileName) {
    return Response.json(
      { error: "permitReference and fileName are required." },
      { status: 400 }
    );
  }
  if (!ATTACHMENT_KIND_VALUES.includes(kind)) {
    return Response.json({ error: "Invalid attachment kind." }, { status: 400 });
  }
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return Response.json(
      { error: "Only PDF or JPEG files are allowed." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
    return Response.json(
      { error: `File must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.` },
      { status: 400 }
    );
  }

  const r2Key = `attachments/${sanitizeForKey(permitReference)}/${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  let uploadUrl;
  try {
    uploadUrl = getUploadUrl(r2Key, { expiresInSeconds: 300 });
  } catch (err) {
    console.error("R2 presign failed:", err);
    return Response.json(
      { error: "Storage isn't configured yet. Check R2 env vars." },
      { status: 500 }
    );
  }

  return Response.json({ uploadUrl, r2Key });
}
