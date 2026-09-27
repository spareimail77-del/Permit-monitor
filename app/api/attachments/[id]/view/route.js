import { createClient } from "../../../../../lib/supabase/server";
import { getViewUrl } from "../../../../../lib/storage";

export async function GET(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: attachment } = await supabase
    .from("permit_attachments")
    .select("storage_key, content_type")
    .eq("id", params.id)
    .single();

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  // Step 14 hook: this is where a "viewed attachment" activity-log
  // entry will be written once that table exists.

  let url;
  try {
    url = getViewUrl(attachment.storage_key, {
      contentType: attachment.content_type,
      expiresInSeconds: 300,
    });
  } catch (err) {
    console.error("Cloudinary signed URL failed:", err);
    return Response.json({ error: "Storage isn't configured." }, { status: 500 });
  }

  return Response.redirect(url, 302);
}
