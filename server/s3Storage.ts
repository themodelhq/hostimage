import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// ElasticLake is S3-compatible with path-style addressing.
// Public URL pattern: https://app.elasticlake.com/<bucket>/<key>

function getS3Client() {
  const accessKeyId = process.env.ELK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ELK_SECRET_ACCESS_KEY;
  const endpoint = process.env.ELK_ENDPOINT ?? "https://app.elasticlake.com";
  const region = process.env.ELK_REGION ?? "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "ElasticLake credentials missing: set ELK_ACCESS_KEY_ID and ELK_SECRET_ACCESS_KEY in Vercel environment variables."
    );
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true, // required for ElasticLake (path-style: endpoint/bucket/key)
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function s3Put(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const bucket = process.env.ELK_BUCKET;
  const endpoint = process.env.ELK_ENDPOINT ?? "https://app.elasticlake.com";

  if (!bucket) {
    throw new Error(
      "ELK_BUCKET is not set in Vercel environment variables."
    );
  }

  const client = getS3Client();
  const normalizedKey = key.replace(/^\/+/, "");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
      Body: data,
      ContentType: contentType,
      ACL: "public-read", // make uploaded files publicly accessible
    })
  );

  // ElasticLake public URL: endpoint/bucket/key
  const base = endpoint.replace(/\/+$/, "");
  return `${base}/${bucket}/${normalizedKey}`;
}
