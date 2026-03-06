/**
 * ElasticLake (S3-compatible) storage — implemented with plain fetch + AWS
 * Signature V4 so there is no dependency on @aws-sdk at runtime and no
 * TypeScript issues with the SDK's class types.
 */

import { createHmac, createHash } from "node:crypto";

function getConfig() {
  const accessKeyId     = process.env.ELK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ELK_SECRET_ACCESS_KEY;
  const endpoint        = process.env.ELK_ENDPOINT ?? "https://app.elasticlake.com";
  const region          = process.env.ELK_REGION   ?? "us-east-1";
  const bucket          = process.env.ELK_BUCKET;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "ElasticLake credentials missing: set ELK_ACCESS_KEY_ID and ELK_SECRET_ACCESS_KEY in Vercel environment variables."
    );
  }
  if (!bucket) {
    throw new Error(
      "ELK_BUCKET is not set in Vercel environment variables."
    );
  }

  return { accessKeyId, secretAccessKey, endpoint: endpoint.replace(/\/+$/, ""), region, bucket };
}

// ── AWS Signature V4 helpers ─────────────────────────────────────────────────

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate    = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion  = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

function isoDate(now: Date) {
  return (
    now.getUTCFullYear().toString() +
    pad2(now.getUTCMonth() + 1) +
    pad2(now.getUTCDate()) +
    "T" +
    pad2(now.getUTCHours()) +
    pad2(now.getUTCMinutes()) +
    pad2(now.getUTCSeconds()) +
    "Z"
  );
}

// ── Public upload function ───────────────────────────────────────────────────

export async function s3Put(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const { accessKeyId, secretAccessKey, endpoint, region, bucket } = getConfig();

  const normalizedKey = key.replace(/^\/+/, "");
  const now           = new Date();
  const amzDate       = isoDate(now);
  const dateStamp     = amzDate.slice(0, 8);
  const service       = "s3";

  const url     = `${endpoint}/${bucket}/${normalizedKey}`;
  const bodyHash = sha256Hex(data);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${new URL(endpoint).host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${bucket}/${normalizedKey}`,
    "",                  // no query string
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = hmacSha256(
    signingKey(secretAccessKey, dateStamp, region, service),
    stringToSign
  ).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type":          contentType,
      "x-amz-acl":             "public-read",
      "x-amz-content-sha256":  bodyHash,
      "x-amz-date":            amzDate,
      Authorization:            authorization,
    },
    body: data,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`ElasticLake upload failed (${response.status}): ${text}`);
  }

  // Public URL: endpoint/bucket/key
  return `${endpoint}/${bucket}/${normalizedKey}`;
}
