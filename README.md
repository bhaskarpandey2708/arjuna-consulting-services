# Arjuna Strategy Consulting

Standalone Node.js website for Arjuna Strategy Consulting with:

- a no-dependency HTTP server
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

## Project structure

- `server.js`: HTTP server, routes, API handling, static asset delivery
- `src/site-content.js`: structured content and profile data
- `src/template.js`: HTML rendering
- `public/styles.css`: layout and visual system
- `public/app.js`: reveal animations and contact form submission
- `data/inquiries.json`: locally stored consultation requests
