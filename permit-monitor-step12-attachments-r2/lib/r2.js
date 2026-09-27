import crypto from "node:crypto";

// Cloudflare R2 speaks the S3 API. Rather than pull in the full
// @aws-sdk/client-s3 (~large) plus @aws-sdk/s3-request-presigner just
// for "give me a temporary signed URL", this hand-implements AWS
// Signature V4 query-string presigning using only Node's built-in
// crypto module. No new dependency, so nothing to add to
// package-lock.json.

const REGION = "auto";
const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

// AWS requires strict RFC 3986 percent-encoding. encodeURIComponent
// gets 95% of the way there but leaves ! ' ( ) * unescaped, so those
// are patched up by hand.
function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing R2 env vars — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME."
    );
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    host: `${accountId}.r2.cloudflarestorage.com`,
  };
}

// method: "GET", "PUT" or "DELETE". key: the object key (path within
// the bucket), may contain "/". expiresInSeconds: how long the URL
// stays valid for — keep this short-lived since anyone with the URL
// can use it while it's live.
function presign({ method, key, expiresInSeconds }) {
  const { accessKeyId, secretAccessKey, bucket, host } = getConfig();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const canonicalUri =
    "/" + bucket + "/" + key.split("/").map(encodeRFC3986).join("/");

  const queryParams = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRFC3986(k)}=${encodeRFC3986(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const signingKey = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// A short-lived URL the browser can PUT the file bytes to directly —
// the file never passes through our own server/function, which
// matters since Vercel serverless functions cap request bodies well
// under the 10-20MB these attachments can be.
export function getUploadUrl(key, { expiresInSeconds = 300 } = {}) {
  return presign({ method: "PUT", key, expiresInSeconds });
}

// A short-lived URL to view/download the file. Kept short (a few
// minutes) since anyone holding the link can use it while it's live.
export function getViewUrl(key, { expiresInSeconds = 300 } = {}) {
  return presign({ method: "GET", key, expiresInSeconds });
}

export async function deleteObject(key) {
  const url = presign({ method: "DELETE", key, expiresInSeconds: 60 });
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status} ${await res.text()}`);
  }
}
