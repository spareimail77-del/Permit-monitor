import crypto from "node:crypto";

// Backblaze B2 has an S3-compatible API. Rather than pull in the full
// @aws-sdk/client-s3 (~large) plus @aws-sdk/s3-request-presigner just
// for "give me a temporary signed URL", this hand-implements AWS
// Signature V4 query-string presigning using only Node's built-in
// crypto module. No new dependency, so nothing to add to
// package-lock.json.

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
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_NAME;
  // Bucket ID (not name) — shown on the bucket's page in the B2
  // dashboard, e.g. "6d0eae8d082fe029a90f0b1f". Only needed for
  // native-API uploads (getUploadCredentials below); GET/DELETE still
  // use the bucket name via the S3-compatible API.
  const bucketId = process.env.B2_BUCKET_ID;
  // e.g. "s3.us-west-004.backblazeb2.com" — copy this exactly from
  // your bucket's details page in the B2 dashboard, it varies per
  // bucket/region.
  const host = process.env.B2_ENDPOINT;

  if (!keyId || !applicationKey || !bucket || !bucketId || !host) {
    throw new Error(
      "Missing B2 env vars — set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_BUCKET_ID, B2_ENDPOINT."
    );
  }

  // The region is embedded in the endpoint host, e.g.
  // "s3.us-west-004.backblazeb2.com" -> "us-west-004".
  const region = host.split(".")[1];
  if (!region) {
    throw new Error(
      `Could not read a region out of B2_ENDPOINT ("${host}") — it should look like s3.us-west-004.backblazeb2.com.`
    );
  }

  return { keyId, applicationKey, bucket, bucketId, host, region };
}

// method: "GET", "PUT" or "DELETE". key: the object key (path within
// the bucket), may contain "/". expiresInSeconds: how long the URL
// stays valid for — keep this short-lived since anyone with the URL
// can use it while it's live.
function presign({ method, key, expiresInSeconds }) {
  const { keyId, applicationKey, bucket, host, region } = getConfig();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;

  const canonicalUri =
    "/" + bucket + "/" + key.split("/").map(encodeRFC3986).join("/");

  const queryParams = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${keyId}/${credentialScope}`,
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

  const kDate = hmac("AWS4" + applicationKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const signingKey = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// Backblaze's S3-compatible API doesn't implement browser-POST
// uploads (confirmed: not in their documented "Supported Calls"
// list, returns 501). And a presigned PUT link runs into a separate
// problem: the browser's required CORS preflight (OPTIONS) hits that
// same signed URL, and B2 rejects it with 403 — the signature was
// only ever valid for a PUT, and there isn't one for OPTIONS.
//
// So uploads instead go through B2's own native API, which uses a
// plain bearer token rather than a request-bound signature. A
// preflight never carries header *values* (only the names it's
// about to send), so there's no token for B2 to (wrongly) validate
// on the OPTIONS request — this is the same mechanism Backblaze's
// own upload widgets use for browser uploads.
//
// Returns { uploadUrl, uploadAuthToken } — POST the file directly to
// uploadUrl with headers: Authorization: <uploadAuthToken>,
// "X-Bz-File-Name": encodeB2FileName(key), "Content-Type": <type>,
// "X-Bz-Content-Sha1": "do_not_verify".
export async function getUploadCredentials() {
  const { keyId, applicationKey, bucketId } = getConfig();

  const authRes = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${keyId}:${applicationKey}`).toString("base64"),
      },
    }
  );
  if (!authRes.ok) {
    throw new Error(`B2 authorize failed: ${authRes.status} ${await authRes.text()}`);
  }
  const authData = await authRes.json();
  const apiUrl = authData?.apiInfo?.storageApi?.apiUrl || authData?.apiUrl;
  const accountAuthToken = authData.authorizationToken;
  if (!apiUrl || !accountAuthToken) {
    throw new Error("Unexpected response shape from B2 b2_authorize_account.");
  }

  const uploadUrlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: accountAuthToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId }),
  });
  if (!uploadUrlRes.ok) {
    throw new Error(
      `B2 get_upload_url failed: ${uploadUrlRes.status} ${await uploadUrlRes.text()}`
    );
  }
  const uploadUrlData = await uploadUrlRes.json();

  return {
    uploadUrl: uploadUrlData.uploadUrl,
    uploadAuthToken: uploadUrlData.authorizationToken,
  };
}

// B2's native API wants the file name percent-encoded, but with "/"
// left literal so folder-style keys still show as folders.
export function encodeB2FileName(key) {
  return key.split("/").map(encodeURIComponent).join("/");
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
    throw new Error(`B2 delete failed: ${res.status} ${await res.text()}`);
  }
}
