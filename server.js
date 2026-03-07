import express from "express";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

import { siteContent } from "./src/site-content.js";
import { getCanonicalPageMetadata, renderPage } from "./src/template.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const inquiriesFile = path.join(dataDir, "inquiries.json");
const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 3000;
const host = "0.0.0.0";
const maxRequestSize = 1024 * 1024;
const pageRoutes = ["/", "/election-management-campaign-consulting", "/capabilities", "/surveys", "/leadership"];
const routeAliases = new Map([
  ["/track-record", "/capabilities"],
  ["/contact", "/leadership"]
]);
const htmlCacheControl = "public, max-age=300, must-revalidate";
const crawlCacheControl = "public, max-age=300, must-revalidate";
const staticAssetCacheControl = "public, max-age=86400";
const apiCacheControl = "no-store";
const contactRateLimitWindowMs = 15 * 60 * 1000;
const contactRateLimitMax = 5;
const contactWebhookTimeoutMs = 5000;
const contactRateLimitStore = new Map();

const app = express();
app.set("trust proxy", true);

app.disable("x-powered-by");

function normalizeSiteUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");

    return `${parsed.origin}${pathname}`;
  } catch {
    return "";
  }
}

function normalizeAbsoluteUrl(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

function buildAbsoluteUrl(baseUrl, pathname = "") {
  const normalizedBase = String(baseUrl).replace(/\/+$/, "");

  if (!pathname || pathname === "/") {
    return normalizedBase;
  }

  return `${normalizedBase}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getRequestOrigin(req) {
  const protocol = req.protocol || "http";
  const host = req.get("host") || "127.0.0.1:3000";

  return `${protocol}://${host}`;
}

const configuredSiteUrl = normalizeSiteUrl(process.env.SITE_URL);
const configuredContactWebhookUrl = normalizeAbsoluteUrl(process.env.CONTACT_WEBHOOK_URL);
const disableLocalInquiryStore = process.env.DISABLE_LOCAL_INQUIRY_STORE === "true";

if (disableLocalInquiryStore && !configuredContactWebhookUrl) {
  throw new Error(
    "DISABLE_LOCAL_INQUIRY_STORE=true requires CONTACT_WEBHOOK_URL so contact submissions still have a delivery target."
  );
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

function getRenderContext(req, res) {
  const requestOrigin = getRequestOrigin(req);

  return {
    baseUrl: configuredSiteUrl || requestOrigin,
    allowIndexing: Boolean(configuredSiteUrl),
    cspNonce: res.locals?.cspNonce ?? ""
  };
}

function buildContentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

function isSecureRequest(req) {
  if (req.secure) {
    return true;
  }

  return String(req.get("x-forwarded-proto") || "").split(",")[0].trim() === "https";
}

function pruneContactRateLimitStore(now) {
  for (const [key, timestamps] of contactRateLimitStore.entries()) {
    const fresh = timestamps.filter((timestamp) => now - timestamp < contactRateLimitWindowMs);

    if (fresh.length > 0) {
      contactRateLimitStore.set(key, fresh);
    } else {
      contactRateLimitStore.delete(key);
    }
  }
}

function checkContactRateLimit(req) {
  const now = Date.now();
  const clientKey = req.ip || "unknown";
  const existing = contactRateLimitStore.get(clientKey) ?? [];
  const fresh = existing.filter((timestamp) => now - timestamp < contactRateLimitWindowMs);

  if (contactRateLimitStore.size > 1000) {
    pruneContactRateLimitStore(now);
  }

  if (fresh.length >= contactRateLimitMax) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((contactRateLimitWindowMs - (now - fresh[0])) / 1000)
    );

    return {
      limited: true,
      retryAfterSeconds
    };
  }

  fresh.push(now);
  contactRateLimitStore.set(clientKey, fresh);

  return {
    limited: false,
    retryAfterSeconds: 0
  };
}

async function dispatchInquiry(entry, req) {
  const payload = {
    source: "arjuna-strategy-consulting",
    page: req.get("origin") || getRequestOrigin(req),
    submittedAt: entry.createdAt,
    inquiry: entry
  };

  if (!disableLocalInquiryStore) {
    await persistInquiry(entry);
  }

  if (!configuredContactWebhookUrl) {
    return;
  }

  const response = await fetch(configuredContactWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(contactWebhookTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Contact webhook failed with status ${response.status}.`);
  }
}

function maybeSetNoIndexHeader(res, allowIndexing) {
  if (!allowIndexing) {
    res.set("X-Robots-Tag", "noindex, nofollow");
  }
}

function renderRobotsTxt(context) {
  if (!context.allowIndexing) {
    return "User-agent: *\nDisallow: /\n";
  }

  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${buildAbsoluteUrl(context.baseUrl, "/sitemap.xml")}`,
    ""
  ].join("\n");
}

function renderSitemapXml(context) {
  const entries = getCanonicalPageMetadata()
    .map((page) => {
      const loc = buildAbsoluteUrl(context.baseUrl, page.pathname === "/" ? "" : page.pathname);

      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function renderLlmsTxt(context) {
  const pages = getCanonicalPageMetadata()
    .map(
      (page) =>
        `- ${buildAbsoluteUrl(context.baseUrl, page.pathname === "/" ? "" : page.pathname)}: ${page.description}`
    )
    .join("\n");

  return [
    `# ${siteContent.brand.name}`,
    "",
    siteContent.seo.llmsSummary,
    "",
    "## Geography",
    "National service brand for campaigns in India. No public street address is published on the site.",
    "",
    "## Core services",
    ...siteContent.seo.serviceCatalog.map((item) => `- ${item}`),
    "",
    "## Audiences",
    ...siteContent.seo.audiences.map((item) => `- ${item}`),
    "",
    "## Canonical pages",
    pages,
    "",
    "## Proof points",
    "- 103 assembly constituencies supported.",
    "- 66% strike rate in the 2025 Delhi AC portfolio.",
    "- Bihar scale program delivered data and outreach systems across 94 Assembly Constituencies.",
    "",
    "## Contact",
    `- Email: ${siteContent.contact.details.email}`,
    `- Phone: +91 ${siteContent.contact.details.phones[0]}`,
    `- Phone: +91 ${siteContent.contact.details.phones[1]}`,
    ""
  ].join("\n");
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

app.use(express.json({ limit: maxRequestSize }));

app.use((req, res, next) => {
  const cspNonce = randomBytes(16).toString("base64");

  res.locals.cspNonce = cspNonce;
  res.set("Content-Security-Policy", buildContentSecurityPolicy(cspNonce));
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  res.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");

  if (isSecureRequest(req)) {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", apiCacheControl);
  next();
});

app.use((req, res, next) => {
  const routePath = normalizeRoute(req.path);
  const finalPath = routeAliases.get(routePath) ?? routePath;

  if (finalPath !== req.path) {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.set("Cache-Control", htmlCacheControl);
    res.redirect(308, `${finalPath}${query}`);
    return;
  }

  next();
});

app.use(express.static(publicDir, {
  setHeaders(res) {
    res.set("Cache-Control", staticAssetCacheControl);
  }
}));

app.get("/robots.txt", (req, res) => {
  const context = getRenderContext(req, res);

  res.type("text/plain");
  res.set("Cache-Control", crawlCacheControl);
  maybeSetNoIndexHeader(res, context.allowIndexing);
  res.send(renderRobotsTxt(context));
});

app.get("/sitemap.xml", (req, res) => {
  const context = getRenderContext(req, res);

  res.type("application/xml");
  res.set("Cache-Control", crawlCacheControl);
  maybeSetNoIndexHeader(res, context.allowIndexing);
  res.send(renderSitemapXml(context));
});

app.get("/llms.txt", (req, res) => {
  const context = getRenderContext(req, res);

  res.type("text/plain");
  res.set("Cache-Control", crawlCacheControl);
  maybeSetNoIndexHeader(res, context.allowIndexing);
  res.send(renderLlmsTxt(context));
});

app.get(pageRoutes, (req, res) => {
  const context = getRenderContext(req, res);

  res.type("html");
  res.set("Cache-Control", htmlCacheControl);
  maybeSetNoIndexHeader(res, context.allowIndexing);
  res.send(renderPage(normalizeRoute(req.path), context));
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
    const rateLimit = checkContactRateLimit(req);

    if (rateLimit.limited) {
      res.set("Retry-After", String(rateLimit.retryAfterSeconds));
      res.status(429).json({
        ok: false,
        errors: ["Too many requests. Please try again shortly."]
      });
      return;
    }

    if (typeof req.body?.website === "string" && req.body.website.trim() !== "") {
      res.status(201).json({
        ok: true,
        message: "Consultation request received. We will get back to you shortly."
      });
      return;
    }

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
      createdAt: new Date().toISOString(),
      source: {
        ip: req.ip || "",
        userAgent: req.get("user-agent") || ""
      }
    };

    await dispatchInquiry(entry, req);

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
  res.set("Cache-Control", apiCacheControl);
  res.status(404).json({
    ok: false,
    message: "Not found"
  });
});

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.set("Cache-Control", apiCacheControl);
    res.status(413).json({
      ok: false,
      errors: ["Request body too large."]
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.set("Cache-Control", apiCacheControl);
    res.status(400).json({
      ok: false,
      errors: ["Invalid JSON payload."]
    });
    return;
  }

  res.set("Cache-Control", apiCacheControl);
  res.status(500).json({
    ok: false,
    errors: ["Unable to process the request."]
  });
});

app.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Arjuna Strategy Consulting site is running on http://${displayHost}:${port}`);
});
