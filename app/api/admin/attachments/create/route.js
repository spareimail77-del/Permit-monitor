import { createClient } from "../../../../../lib/supabase/server";
import {
import { getAccess, hasPermission } from "../../../../../lib/authz";
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_LABEL_LENGTH,
  sanitizeLabel,
} from "../../../../../lib/attachments";

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
  const { permitReference, label, fileName, storageKey, contentType, sizeBytes } = body || {};

  if (!permitReference || !fileName || !storageKey) {
    return Response.json(
      { error: "permitReference, fileName and storageKey are required." },
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
    return Response.json({ error: "Invalid content type." }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: "Invalid file size." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("permit_attachments")
    .insert({
      permit_reference: permitReference,
      label: cleanLabel,
      file_name: fileName,
      storage_key: storageKey,
      content_type: contentType,
      size_bytes: sizeBytes,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Attachment insert failed:", error);
    return Response.json({ error: "Could not save attachment." }, { status: 500 });
  }

  return Response.json({ ok: true, attachment: data });
}
