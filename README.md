# Arjuna Strategy Consulting

Standalone Express.js website for Arjuna Strategy Consulting with:

- an Express.js application server
- a responsive single-page marketing site
- a working `POST /api/contact` endpoint
- local persistence for consultation requests in `data/inquiries.json`

## Run locally

```bash
cd /Users/bhaskar_pandey/Documents/Website/arjuna-consulting-services
npm start
```

The site will start on `http://127.0.0.1:3000` by default.

To use a different port:

```bash
PORT=4000 npm start
```

For production SEO and canonical URLs, set:

```bash
SITE_URL=https://your-production-domain.com npm start
```

If `SITE_URL` is not set, the app falls back to the request origin and emits `noindex` metadata so preview and local environments are not indexed.

For production contact handling, you can also set:

```bash
CONTACT_WEBHOOK_URL=https://your-crm-or-form-endpoint.example.com
DISABLE_LOCAL_INQUIRY_STORE=true
```

If `CONTACT_WEBHOOK_URL` is set, each valid contact submission is POSTed to that endpoint as JSON. If `DISABLE_LOCAL_INQUIRY_STORE=true`, the app requires `CONTACT_WEBHOOK_URL` so submissions still have a delivery target.

## SEO endpoints

- `GET /robots.txt`
- `GET /sitemap.xml`
- `GET /llms.txt`

## Project structure

- `server.js`: Express server, routes, API handling, static asset delivery
- `src/site-content.js`: structured content and profile data
- `src/template.js`: HTML rendering
- `public/styles.css`: layout and visual system
- `public/app.js`: reveal animations and contact form submission
- `data/inquiries.json`: locally stored consultation requests
