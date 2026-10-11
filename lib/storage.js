import { v2 as cloudinary } from "cloudinary";
import { ALLOWED_FILE_TYPES } from "./fileRules";

// Files live in Cloudinary (private: a bare link does not work, only the
// short-lived signed links made here). Server only: this file reads the API
// secret and must never be imported from a "use client" file.
//
// Every SDK call passes cloud_name / api_key / api_secret explicitly, rather
// than relying on a global cloudinary.config() being picked up on each
// serverless run.

function creds() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Missing Cloudinary settings: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }
  return { cloud_name, api_key, api_secret };
}

// Cloudinary sorts uploads by resource type: photos are "image", PDFs "raw".
function resourceTypeFor(contentType) {
  return contentType === "application/pdf" ? "raw" : "image";
}

// What the browser needs to send one file straight to Cloudinary. The
// signature is made here (it needs the secret), so the secret never reaches
// the browser, only this one signed set of values.
export function getUploadCredentials({ storageKey, contentType }) {
  const { cloud_name, api_key, api_secret } = creds();
  const timestamp = Math.round(Date.now() / 1000);
  // type "private": the file cannot be fetched by a bare URL.
  const paramsToSign = { public_id: storageKey, timestamp, type: "private" };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, api_secret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceTypeFor(contentType)}/upload`,
    params: { api_key, timestamp, signature, public_id: storageKey, type: "private" },
  };
}

// PDFs ("raw") are stored with the file extension as part of their name, so
// ask Cloudinary what is really stored under our key and use that.
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
  if (found.length === 0) throw new Error(`No file found in Cloudinary for ${storageKey}`);
  return found.includes(storageKey) ? storageKey : found[0];
}

// A short-lived (5 minute) private download link for one file. Made with the
// Admin API link, not a res.cloudinary.com address: new Cloudinary accounts
// block PDF delivery on those by default.
export async function getViewUrl(storageKey, { contentType, expiresInSeconds = 300 }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);
  const isRaw = resourceType === "raw";
  const publicId = isRaw ? await resolveRawPublicId(storageKey) : storageKey;
  const format = isRaw ? undefined : ALLOWED_FILE_TYPES[contentType] === "PNG image" ? "png" : "jpg";
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "private",
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    attachment: false,
    cloud_name,
    api_key,
    api_secret,
  });
}

// Removes a file (used to clean up when recording it in the database failed).
export async function deleteObject(storageKey, { contentType }) {
  const { cloud_name, api_key, api_secret } = creds();
  const resourceType = resourceTypeFor(contentType);
  let publicId = storageKey;
  if (resourceType === "raw") {
    try {
      publicId = await resolveRawPublicId(storageKey);
    } catch {
      return; // nothing stored under that key
    }
  }
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "private",
    invalidate: true,
    cloud_name,
    api_key,
    api_secret,
  });
}
