import { createClient } from "../../../../../lib/supabase/server";
import { deleteObject } from "../../../../../lib/storage";

export async function DELETE(request, { params }) {
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
      { error: "Not authorized. Only HSE admins can remove attachments." },
      { status: 403 }
    );
  }

  const { data: attachment } = await supabase
    .from("permit_attachments")
    .select("storage_key")
    .eq("id", params.id)
    .single();

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  try {
    await deleteObject(attachment.storage_key);
  } catch (err) {
    console.error("R2 delete failed:", err);
    return Response.json({ error: "Could not delete file from storage." }, { status: 500 });
  }

  const { error } = await supabase
    .from("permit_attachments")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("Attachment row delete failed:", error);
    return Response.json({ error: "File removed, but the record couldn't be cleared. Refresh and check." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
