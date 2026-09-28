import crypto from "node:crypto";
import { createClient } from "../../../../../lib/supabase/server";
import { getUploadCredentials } from "../../../../../lib/storage";
import {
import { getAccess, hasPermission } from "../../../../../lib/authz";
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_LABEL_LENGTH,
  sanitizeForKey,
  sanitizeLabel,
} from "../../../../../lib/attachments";

// Middleware already blocks users without permission from reaching /api/admin/*;
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

  const access = await getAccess(supabase, user.id);

  if (!hasPermission(access, "manage_attachments")) {
    return Response.json(
      { error: "Not authorized. You do not have permission to add attachments." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { permitReference, label, fileName, contentType, sizeBytes } = body || {};

  if (!permitReference || !fileName) {
    return Response.json(
      { error: "permitReference and fileName are required." },
      { status: 400 }
    );
  }
  const cleanLabel = sanitizeLabel(label);
  if (!cleanLabel) {
    return Response.json(
      { error: `Enter what this document is (up to ${MAX_LABEL_LENGTH} characters).` },
      { status: 400 }
    );
  }
  if (!ALLOWED_CONTENT_TYPES[contentType]) {
    return Response.json(
      { error: "Only PDF or JPEG files are allowed." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
    return Response.json(
      { error: `File must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB — compress it and try again.` },
      { status: 400 }
    );
  }

  // No extension here — Cloudinary's public_id doesn't carry one; the
  // format is derived from content_type (already stored on the row)
  // whenever we need it again for view/delete.
  const storageKey = `attachments/${sanitizeForKey(permitReference)}/${sanitizeForKey(cleanLabel)}/${Date.now()}-${crypto.randomUUID()}`;

  let creds;
  try {
    creds = getUploadCredentials({ storageKey, contentType });
  } catch (err) {
    console.error("Cloudinary upload credentials failed:", err);
    return Response.json(
      { error: "Storage isn't configured yet. Check the CLOUDINARY_* env vars." },
      { status: 500 }
    );
  }

  return Response.json({
    uploadUrl: creds.uploadUrl,
    params: creds.params,
    storageKey,
  });
}
