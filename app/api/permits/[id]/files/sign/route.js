import crypto from "node:crypto";
import { getSupabase } from "../../../../../../lib/supabase";
import { getUploadCredentials } from "../../../../../../lib/storage";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from "../../../../../../lib/fileRules";

// Step 1 of adding a file: checks what is about to be sent and returns the
// signed values the browser needs to send it straight to Cloudinary.
export async function POST(request, { params }) {
  const permitId = Number(params.id);
  if (!Number.isInteger(permitId) || permitId < 1) {
    return Response.json({ error: "Unknown permit." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName || "").trim();
  const contentType = String(body?.contentType || "");
  const sizeBytes = Number(body?.sizeBytes);

  if (!fileName) return Response.json({ error: "The file has no name." }, { status: 400 });
  if (!ALLOWED_FILE_TYPES[contentType]) {
    return Response.json({ error: "Only PDF, JPEG or PNG files are allowed." }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
    return Response.json({ error: "The file is empty or larger than 10 MB." }, { status: 400 });
  }

  const { data: permit } = await getSupabase().from("permits").select("id").eq("id", permitId).maybeSingle();
  if (!permit) return Response.json({ error: "This permit does not exist." }, { status: 404 });

  // No extension: Cloudinary's name for the file does not carry one.
  const storageKey = `permits/${permitId}/${Date.now()}-${crypto.randomUUID()}`;

  try {
    const creds = getUploadCredentials({ storageKey, contentType });
    return Response.json({ uploadUrl: creds.uploadUrl, params: creds.params, storageKey });
  } catch (err) {
    console.error("Cloudinary upload credentials failed:", err);
    return Response.json(
      { error: "File storage is not set up. Check the three CLOUDINARY_ settings in Vercel." },
      { status: 500 }
    );
  }
}
