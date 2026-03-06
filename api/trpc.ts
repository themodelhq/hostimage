import { createExpressMiddleware } from "@trpc/server/adapters/express";
// import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

// Create an Express app for handling the request
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Export as Vercel handler
export default async (req: any, res: any) => {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Call the Express app
  return new Promise((resolve) => {
    app(req, res as any, () => {
      resolve(undefined);
    });
  });
};
