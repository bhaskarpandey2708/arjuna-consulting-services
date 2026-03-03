import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

import { renderPage } from "./src/template.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const inquiriesFile = path.join(dataDir, "inquiries.json");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const maxRequestSize = 1024 * 1024;
const pageRoutes = new Set(["/", "/capabilities", "/surveys", "/track-record", "/leadership", "/contact"]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8"
  });
}

async function ensureInquiryStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await stat(inquiriesFile);
  } catch {
    await writeFile(inquiriesFile, "[]\n", "utf8");
  }
}

async function readInquiries() {
  await ensureInquiryStore();

  try {
    const raw = await readFile(inquiriesFile, "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistInquiry(entry) {
  const current = await readInquiries();
  current.unshift(entry);
  await writeFile(inquiriesFile, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

function normalizeText(value, maxLength = 300) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function validateContact(payload) {
  const name = normalizeText(payload?.name, 80);
  const email = normalizeText(payload?.email, 120).toLowerCase();
  const organization = normalizeText(payload?.organization, 120);
  const phone = normalizeText(payload?.phone, 40);
  const constituency = normalizeText(payload?.constituency, 120);
  const campaignType = normalizeText(payload?.campaignType, 80);
  const goals = normalizeText(payload?.goals, 1200);

  const errors = [];

  if (!name || name.length < 2) {
    errors.push("Please provide a valid name.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please provide a valid email address.");
  }

  if (!goals || goals.length < 20) {
    errors.push("Please describe your campaign goals in a bit more detail.");
  }

  return {
    errors,
    value: {
      name,
      email,
      organization,
      phone,
      constituency,
      campaignType,
      goals
    }
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let received = 0;

    req.on("data", (chunk) => {
      received += chunk.length;

      if (received > maxRequestSize) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }

      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    req.on("error", reject);
  });
}

async function serveStaticAsset(res, pathname) {
  const relativePath = pathname.replace(/^\/+/, "");

  if (!relativePath) {
    return false;
  }

  const safePath = path.normalize(relativePath);
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    return false;
  }

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return false;
    }

    const extension = path.extname(filePath).toLowerCase();
    const data = await readFile(filePath);

    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[extension] ?? "application/octet-stream"
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function normalizeRoute(pathname) {
  if (!pathname || pathname === "/index.html") {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = requestUrl;
  const routePath = normalizeRoute(pathname);

  if (req.method === "GET" && pageRoutes.has(routePath)) {
    send(res, 200, renderPage(routePath), {
      "Content-Type": "text/html; charset=utf-8"
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "arjuna-strategy-consulting",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/contact") {
    try {
      const payload = await parseJsonBody(req);
      const { errors, value } = validateContact(payload);

      if (errors.length > 0) {
        sendJson(res, 400, {
          ok: false,
          errors
        });
        return;
      }

      const entry = {
        id: `inq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        ...value,
        createdAt: new Date().toISOString()
      };

      await persistInquiry(entry);

      sendJson(res, 201, {
        ok: true,
        message: "Consultation request received. We will get back to you shortly.",
        inquiryId: entry.id
      });
    } catch (error) {
      const statusCode = error?.message === "Invalid JSON payload." ? 400 : 413;

      sendJson(res, statusCode, {
        ok: false,
        errors: [error?.message ?? "Unable to process the request."]
      });
    }

    return;
  }

  if (req.method === "GET") {
    const served = await serveStaticAsset(res, pathname);

    if (served) {
      return;
    }
  }

  sendJson(res, 404, {
    ok: false,
    message: "Not found"
  });
});

server.listen(port, host, () => {
  console.log(`Arjuna Strategy Consulting site is running on http://${host}:${port}`);
});
