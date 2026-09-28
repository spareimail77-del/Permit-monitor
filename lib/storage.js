import { v2 as cloudinary } from "cloudinary";
import { ALLOWED_CONTENT_TYPES } from "./attachments";

// Cloudinary, not Backblaze. B2 turned out to have three separate,
// confirmed gaps in browser-upload support: no browser-POST on its
// S3-compatible API, a rejected CORS preflight on presigned PUT
// links, and a rejected preflight (no CORS headers at all) on its
// native API too. Cloudinary's upload endpoint answers CORS
// preflights correctly, and doesn't need one at all for the plain
// multipart POST we do below (no custom headers on that request).
//
// Every SDK call below passes cloud_name/api_key/api_secret
// explicitly in its options, rather than relying on the SDK's global
// cloudinary.config() being picked up internally — one less thing to
// get subtly wrong across serverless invocations.

function creds() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Missing Cloudinary env vars — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }
  return { cloud_name, api_key, api_secret };
}

// Cloudinary buckets uploads by resource_type: images go through
// "image", everything else (including PDFs) goes through "raw".
function resourceTypeFor(contentType) {
  return contentType === "application/pdf" ? "raw" : "image";
}

// Everything the browser needs to POST the file straight to
// Cloudinary. The signature is computed here (it needs the API
// secret) so the secret itself never reaches the browser — only this
// one-time signed param set does.
export function getUploadCredentials({ storageKey, contentType }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);
  const timestamp = Math.round(Date.now() / 1000);

  // type: "private" keeps the file un-fetchable by a bare URL — it's
  // only reachable through the signed, expiring link getViewUrl mints
  // below. This is the Cloudinary equivalent of the old 300s
  // presigned B2 GET link.
  const paramsToSign = { public_id: storageKey, timestamp, type: "private" };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, api_secret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`,
    params: { api_key, timestamp, signature, public_id: storageKey, type: "private" },
  };
}

// Raw files (our PDFs) are the awkward case: Cloudinary treats the
// file extension as part of a raw file's public_id, and what actually
// got stored from a browser upload doesn't match the key we generated
// (two different guesses both came back "Resource not found"). Rather
// than guess a third time, ask Cloudinary what's really stored under
// that key's prefix and use the real public_id it reports.
async function resolveRawPublicId(storageKey) {
  const { cloud_name, api_key, api_secret } = creds();
  const result = await cloudinary.api.resources({
    resource_type: "raw",
    type: "private",
    prefix: storageKey,
    max_results: 5,
    cloud_name,
    api_key,
    api_secret,
  });
  const found = (result.resources || []).map((r) => r.public_id);
  if (found.length === 0) {
    throw new Error(`No raw file found in Cloudinary for key ${storageKey}`);
  }
  return found.includes(storageKey) ? storageKey : found[0];
}

// Short-lived (5 min) private download link for the file.
// PDFs (raw) first resolve the file's real public_id (see above — it
// includes ".pdf"), then use the same Admin-API download link as
// images, with no separate format. We deliberately do NOT use a
// res.cloudinary.com delivery URL for PDFs: new Cloudinary accounts
// block PDF/ZIP *delivery* by default (401 "deny or ACL failure"), and
// this download link isn't subject to that setting.
export async function getViewUrl(storageKey, { contentType, expiresInSeconds = 300 }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);
  const isRaw = resourceType === "raw";

  const publicId = isRaw ? await resolveRawPublicId(storageKey) : storageKey;
  const format = isRaw ? undefined : ALLOWED_CONTENT_TYPES[contentType];
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "private",
    expires_at: expiresAt,
    attachment: false,
    cloud_name,
    api_key,
    api_secret,
  });
}

export async function deleteObject(storageKey, { contentType }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);

  // cloudinary.uploader.destroy is (public_id, options) in the v2
  // SDK — options is the SECOND argument, not the third. An earlier
  // version of this function passed `undefined, {options}`, which
  // silently dropped the options object (including resource_type and
  // type: "private") and made every delete fail.
  // Raw files may be stored under a different public_id than our key
  // (see resolveRawPublicId) — delete the real one, or the file would
  // be left orphaned while we report success.
  let publicId = storageKey;
  if (resourceType === "raw") {
    try {
      publicId = await resolveRawPublicId(storageKey);
    } catch {
      return; // nothing stored under that key — nothing to delete
    }
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "private",
    invalidate: true,
    cloud_name,
    api_key,
    api_secret,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${JSON.stringify(result)}`);
  }
}
