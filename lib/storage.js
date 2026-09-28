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

// A short-lived URL to view/download the file (mirrors the old B2
// getViewUrl: a few minutes, since anyone holding the link can use it
// while it's live).
export function getViewUrl(storageKey, { contentType, expiresInSeconds = 300 }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);
  // Images are looked up as "<public_id>.<format>", so they need the
  // format. Raw files (our PDFs) are different: Cloudinary treats the
  // extension as part of a raw file's public_id, and ours was stored
  // without one — so passing "pdf" here makes it look for
  // "<public_id>.pdf", which doesn't exist ("Resource not found").
  // Leave the format off for raw files.
  const format =
    resourceType === "raw" ? undefined : ALLOWED_CONTENT_TYPES[contentType];
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return cloudinary.utils.private_download_url(storageKey, format, {
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
  const result = await cloudinary.uploader.destroy(storageKey, {
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
