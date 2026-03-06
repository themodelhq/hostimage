import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/routers";
import { parse as parseCookies } from "cookie";
import { jwtVerify } from "jose";
import { getUserByOpenId } from "../server/db";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  "Access-Control-Allow-Headers":
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
};

async function getUserFromRequest(req: any) {
  try {
    const cookieHeader = req.headers?.cookie as string | undefined;
    if (!cookieHeader || !ENV.cookieSecret) return null;
    const cookies = parseCookies(cookieHeader);
    const token = cookies["app_session_id"];
    if (!token) return null;
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const openId = payload["openId"] as string | undefined;
    if (!openId) return null;
    return (await getUserByOpenId(openId)) ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // CORS preflight
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  // Read raw body from Node stream (Vercel may or may not pre-parse it)
  const rawBody: string = await new Promise((resolve) => {
    if (req.body !== undefined) {
      resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

  // Reconstruct a proper Web API Request for fetchRequestHandler
  const url = `https://${req.headers.host}${req.url}`;

  const webRequest = new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : rawBody || null,
  });

  const user = await getUserFromRequest(req);

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: webRequest,
    router: appRouter,
    createContext: async (): Promise<TrpcContext> => ({
      req,
      res,
      user,
    }),
    onError({ error, path }) {
      console.error(`[tRPC] /${path}:`, error.message);
    },
  });

  // Write Web API Response back to Node res
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");
  const body = await response.text();
  return res.end(body);
}
