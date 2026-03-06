import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as XLSX from "xlsx";
import sharp from "sharp";
import { s3Put } from "./s3Storage";
import { nanoid } from "nanoid";

const IMAGE_COLUMNS = [
  "MainImage",
  "Image2",
  "Image3",
  "Image4",
  "Image5",
  "Image6",
  "Image7",
  "Image8",
];

/**
 * Sanitize a URL that may have unencoded special characters (e.g. & in path).
 */
function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = url.pathname
      .split("/")
      .map((segment) => {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Derive a safe S3 key from the original URL filename.
 */
function deriveStorageKey(url: string, extension: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/");
    const rawFilename = decodeURIComponent(pathParts[pathParts.length - 1]);
    const baseName = rawFilename
      .split("?")[0]
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    return `converted-images/${baseName || nanoid()}.${extension}`;
  } catch {
    return `converted-images/${nanoid()}.${extension}`;
  }
}

function formatMeta(format: "jpeg" | "png" | "webp" | "tiff") {
  const map = {
    jpeg: { contentType: "image/jpeg", fileExtension: "jpg" },
    png:  { contentType: "image/png",  fileExtension: "png" },
    webp: { contentType: "image/webp", fileExtension: "webp" },
    tiff: { contentType: "image/tiff", fileExtension: "tiff" },
  } as const;
  return map[format];
}

async function convertImage(
  buffer: Buffer,
  format: "jpeg" | "png" | "webp" | "tiff"
): Promise<Buffer> {
  const img = sharp(buffer);
  switch (format) {
    case "jpeg": return img.jpeg({ quality: 90 }).toBuffer();
    case "png":  return img.png().toBuffer();
    case "webp": return img.webp({ quality: 90 }).toBuffer();
    case "tiff": return img.tiff().toBuffer();
  }
}

export const imageConverterRouter = router({
  convertAndHost: publicProcedure
    .input(
      z.object({
        excelFileBase64: z.string(),
        targetFormat: z
          .enum(["jpeg", "png", "webp", "tiff"])
          .default("jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      const { excelFileBase64, targetFormat } = input;

      // 1. Parse Excel
      const excelBuffer = Buffer.from(excelFileBase64, "base64");
      const workbook = XLSX.read(excelBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: "",
      });

      if (data.length < 2) {
        throw new Error("Excel file has no data rows.");
      }

      const headerRow = data[0] as string[];

      // Collect unique non-empty image URLs
      const seen = new Set<string>();
      const imageUrls: string[] = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i] as string[];
        for (const colName of IMAGE_COLUMNS) {
          const colIndex = headerRow.indexOf(colName);
          if (colIndex === -1) continue;
          const raw = (row[colIndex] ?? "").toString().trim();
          if (!raw || seen.has(raw)) continue;
          seen.add(raw);
          imageUrls.push(raw);
        }
      }

      if (imageUrls.length === 0) {
        throw new Error(
          "No image URLs found. Ensure columns are named MainImage, Image2 … Image8."
        );
      }

      // 2. Convert and upload each image
      const { contentType, fileExtension } = formatMeta(targetFormat);

      const convertedImageUrls: {
        originalUrl: string;
        convertedUrl: string;
        error?: string;
      }[] = [];

      for (const rawUrl of imageUrls) {
        const url = sanitizeUrl(rawUrl);
        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; ImageConverter/1.0)",
            },
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            convertedImageUrls.push({
              originalUrl: rawUrl,
              convertedUrl: "",
              error: `Download failed: ${response.status} ${response.statusText}`,
            });
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);
          const convertedBuffer = await convertImage(imageBuffer, targetFormat);
          const storageKey = deriveStorageKey(url, fileExtension);
          const hostedUrl = await s3Put(storageKey, convertedBuffer, contentType);

          convertedImageUrls.push({ originalUrl: rawUrl, convertedUrl: hostedUrl });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Error processing ${url}:`, message);
          convertedImageUrls.push({
            originalUrl: rawUrl,
            convertedUrl: "",
            error: message,
          });
        }
      }

      const successCount = convertedImageUrls.filter((r) => r.convertedUrl).length;

      return {
        convertedImageUrls,
        summary: {
          total: imageUrls.length,
          succeeded: successCount,
          failed: imageUrls.length - successCount,
        },
      };
    }),
});
