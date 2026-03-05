import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as XLSX from "xlsx";
import sharp from "sharp";
import { storagePut } from "./storage";

export const imageConverterRouter = router({
  convertAndHost: publicProcedure
    .input(z.object({
      excelFileBase64: z.string(),
      targetFormat: z.enum(["jpeg", "png", "webp", "tiff"]).default("jpeg"),
    }))
    .mutation(async ({ input }) => {
      const { excelFileBase64, targetFormat } = input;

      // Decode base64 Excel file
      const excelBuffer = Buffer.from(excelFileBase64, "base64");
      const workbook = XLSX.read(excelBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const imageUrls: string[] = [];
      // Assuming image URLs are in columns MainImage, Image2, ..., Image8
      const imageColumns = ["MainImage", "Image2", "Image3", "Image4", "Image5", "Image6", "Image7", "Image8"];
      const headerRow = data[0] as string[];

      for (let i = 1; i < data.length; i++) {
        const row = data[i] as string[];
        for (const colName of imageColumns) {
          const colIndex = headerRow.indexOf(colName);
          if (colIndex !== -1 && row[colIndex]) {
            imageUrls.push(row[colIndex]);
          }
        }
      }

      const convertedImageUrls: { originalUrl: string; convertedUrl: string }[] = [];

      for (const url of imageUrls) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.error(`Failed to download image from ${url}: ${response.statusText}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);

          let convertedBuffer: Buffer;
          let contentType: string;
          let fileExtension: string;

          if (targetFormat === "jpeg") {
            convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
            contentType = "image/jpeg";
            fileExtension = "jpg";
          } else if (targetFormat === "png") {
            convertedBuffer = await sharp(imageBuffer).png().toBuffer();
            contentType = "image/png";
            fileExtension = "png";
          } else if (targetFormat === "webp") {
            convertedBuffer = await sharp(imageBuffer).webp().toBuffer();
            contentType = "image/webp";
            fileExtension = "webp";
          } else if (targetFormat === "tiff") {
            convertedBuffer = await sharp(imageBuffer).tiff().toBuffer();
            contentType = "image/tiff";
            fileExtension = "tiff";
          } else {
            // Default to jpeg if an unsupported format is requested
            convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
            contentType = "image/jpeg";
            fileExtension = "jpg";
          }

          const originalFileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
          const newFileName = `${originalFileName.split('.')[0]}.${fileExtension}`;
          const relKey = `converted-images/${newFileName}`;

          const { url: hostedUrl } = await storagePut(relKey, convertedBuffer, contentType);
          convertedImageUrls.push({ originalUrl: url, convertedUrl: hostedUrl });
        } catch (error) {
          console.error(`Error processing image ${url}:`, error);
        }
      }

      return { convertedImageUrls };
    }),
});
