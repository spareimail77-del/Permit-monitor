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
  // e.g. "s3.us-west-004.backblazeb2.com" — copy this exactly from
  // your bucket's details page in the B2 dashboard, it varies per
  // bucket/region.
  const host = process.env.B2_ENDPOINT;

  if (!keyId || !applicationKey || !bucket || !host) {
    throw new Error(
      "Missing B2 env vars — set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT."
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

  return { keyId, applicationKey, bucket, host, region };
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

// A short-lived PRESIGNED POST FORM the browser can submit the file
// to directly. Deliberately not a presigned PUT link: a plain PUT
// upload from a browser triggers a CORS preflight (OPTIONS) against
// that exact signed URL, and Backblaze rejects that preflight with a
// 403 because the signature was only ever valid for a PUT, not an
// OPTIONS. A form POST with a file field is a browser "simple
// request" and never triggers a preflight at all, so this sidesteps
// the problem rather than needing a CORS workaround for it.
//
// Returns { url, fields } — POST a FormData to `url` with every entry
// in `fields` set first, and the file appended last under the key
// "file".
export function getUploadPost(key, { contentType, maxBytes, expiresInSeconds = 300 } = {}) {
  const { keyId, applicationKey, bucket, host, region } = getConfig();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const credential = `${keyId}/${credentialScope}`;
  const expiration = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

  const conditions = [
    { bucket },
    { key },
    { "x-amz-algorithm": ALGORITHM },
    { "x-amz-credential": credential },
    { "x-amz-date": amzDate },
    ["content-length-range", 0, maxBytes],
  ];
  if (contentType) {
    conditions.push({ "Content-Type": contentType });
  }

  const policy = Buffer.from(
    JSON.stringify({ expiration, conditions })
  ).toString("base64");

  const kDate = hmac("AWS4" + applicationKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const signingKey = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(policy, "utf8")
    .digest("hex");

  return {
    url: `https://${host}/${bucket}`,
    fields: {
      key,
      "Content-Type": contentType,
      "x-amz-algorithm": ALGORITHM,
      "x-amz-credential": credential,
      "x-amz-date": amzDate,
      policy,
      "x-amz-signature": signature,
    },
  };
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
