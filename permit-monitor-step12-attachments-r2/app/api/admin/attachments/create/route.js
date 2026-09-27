import { createClient } from "../../../../../lib/supabase/server";
import {
  ATTACHMENT_KIND_VALUES,
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "../../../../../lib/attachments";

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
  const { permitReference, kind, fileName, r2Key, contentType, sizeBytes } = body || {};

  if (!permitReference || !fileName || !r2Key) {
    return Response.json(
      { error: "permitReference, fileName and r2Key are required." },
      { status: 400 }
    );
  }
  if (!ATTACHMENT_KIND_VALUES.includes(kind)) {
    return Response.json({ error: "Invalid attachment kind." }, { status: 400 });
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
      kind,
      file_name: fileName,
      r2_key: r2Key,
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
