import express from "express";
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
const host = process.env.HOST ?? "0.0.0.0";
const maxRequestSize = 1024 * 1024;
const pageRoutes = ["/", "/capabilities", "/surveys", "/track-record", "/leadership", "/contact"];

const app = express();

app.disable("x-powered-by");

function normalizeRoute(pathname) {
  if (!pathname || pathname === "/index.html") {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
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

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: maxRequestSize }));

app.use((req, res, next) => {
  const routePath = normalizeRoute(req.path);

  if (routePath !== req.path) {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(308, `${routePath}${query}`);
    return;
  }

  next();
});

app.use(express.static(publicDir, {
  setHeaders(res) {
    res.set("Cache-Control", "no-store");
  }
}));

app.get(pageRoutes, (req, res) => {
  res.type("html").send(renderPage(normalizeRoute(req.path)));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "arjuna-strategy-consulting",
    timestamp: new Date().toISOString()
  });
});

app.post("/api/contact", async (req, res, next) => {
  try {
    const { errors, value } = validateContact(req.body ?? {});

    if (errors.length > 0) {
      res.status(400).json({
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

    res.status(201).json({
      ok: true,
      message: "Consultation request received. We will get back to you shortly.",
      inquiryId: entry.id
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Not found"
  });
});

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({
      ok: false,
      errors: ["Request body too large."]
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      ok: false,
      errors: ["Invalid JSON payload."]
    });
    return;
  }

  res.status(500).json({
    ok: false,
    errors: ["Unable to process the request."]
  });
});

app.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Arjuna Strategy Consulting site is running on http://${displayHost}:${port}`);
});
