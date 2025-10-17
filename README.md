# SceneSketch — Developer & Product Document

SceneSketch is a reading companion that **turns any book paragraph into a vivid illustration**. Readers load an EPUB, select text, and generate an AI-crafted scene description and image — then save prompts, images, bookmarks, and highlights.

---

## Table of contents
- [Goals & UX](#goals--ux)
- [Architecture overview](#architecture-overview)
- [Local data & persistence](#local-data--persistence)
- [Server API](#server-api)
- [Client app](#client-app)
- [Setup & running locally](#setup--running-locally)
- [Key implementation details](#key-implementation-details)
- [Accessibility & i18n](#accessibility--i18n)
- [Security & privacy](#security--privacy)
- [Performance considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Project structure](#project-structure)
- [License](#license)

---

## Goals & UX

**Primary goal:** Let readers **illustrate a scene** from any book passage in seconds.

**Flow:**
1. Load an EPUB (local-only).
2. Read normally, paginate or scrub progress.
3. **Highlight text** → Tools drawer opens with the paragraph prefilled.
4. Pick an **art style** → generate a concise **scene prompt** (OpenAI).
5. Edit/approve prompt → generate **image** (Stability AI).
6. Save **prompt**, **image**, **bookmark**; view later in **Saved** or **Downloads**.
7. Resume reading exactly where you left off.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                               Client                                │
│  React + Vite + Tailwind                                            │
│  - EPUB reader (epub.js)                                            │
│  - Tools Drawer (prompt+image)                                      │
│  - Downloads / Saved / Library                                      │
│  - Local persistence (IndexedDB + localStorage)                     │
│                                                                     │
│   ┌──────────────┐              ┌────────────────────┐              │
│   │ useEpubReader│── highlights │ ToolsDrawer/       │── images     │
│   │ hook         │── bookmarks  │ SceneGenerator     │── prompts    │
│   └──────────────┘              └────────────────────┘              │
│           │                              │                          │
│           └───────────── fetch /api ─────┘                          │
└─────────────────────────────────────────────────────────────────────┘
                               ▲
                               │
┌─────────────────────────────────────────────────────────────────────┐
│                               Server                                │
│  Node 18 + Express                                                 │
│  - /api/generate-prompt → OpenAI Chat Completions (scene text)     │
│  - /api/generate-image  → Stability T2I (PNG data URL)             │
│  - In-memory cache (NodeCache, 1h TTL)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Local data & persistence

**Where data lives (client-side):**

- **IndexedDB**
  - `books` (binary EPUB blobs; two stores are used internally: a tiny one in `useEpubReader` for fast open, and a general `db.js` with indices).
  - `positions` (per-book last CFI for **resume to exact page**).

- **localStorage**
  - `ss_library_v1` — list of books (id, name, metadata, `lastCfi` mirror for UI badges).
  - `ss_bookmarks_v1_<bookId>` — bookmarks per book.
  - `ss_gallery_v1` — generated images (as `data:` URLs).
  - `ss_highlights_v1` — saved text highlights.
  - `ss_prompts_v1` — saved prompts.

> Images are stored as base64 `data:` URLs for easy offline viewing. For very large libraries, future work will consider moving images into IndexedDB.

---

## Server API

**Tech:** Express, Node 18+ (global `fetch`), CORS enabled, JSON body.

**Env vars (`server/.env`):**
```env
OPENAI_API_KEY=...
STABILITY_API_KEY=...
```

**Endpoints:**

### `POST /api/generate-prompt`
Creates a **concise visual scene description** from a paragraph.

- **Body**
  ```json
  {
    "paragraph": "The corridor stretched into darkness...",
    "style": "watercolor",
    "bypassCache": false
  }
  ```
- **Response**
  ```json
  { "scenePrompt": "A dim stone corridor recedes into..." }
  ```

- **Notes**
  - Model: `gpt-3.5-turbo` (configurable in code).
  - Prompting constrains output to ~50–100 words, including **setting, characters, mood, perspective**, style-aware.
  - 1h cache keyed by paragraph+style (skip via `bypassCache: true`).

### `POST /api/generate-image`
Generates an **image** from a scene prompt.

- **Body**
  ```json
  {
    "scenePrompt": "A dim stone corridor recedes...",
    "style": "watercolor"
  }
  ```
- **Response**
  ```json
  { "imageUrl": "data:image/png;base64,..." }
  ```

- **Notes**
  - Stability endpoint: `stable-diffusion-xl-1024-v1-0/text-to-image`.
  - 1024×1024, 20 steps, cfg=7, 1 sample.
  - 1h cache keyed by scenePrompt+style.

**Errors:**
- Returns `400` for missing fields; `500` with message if upstream API call fails.

---

## Client app

**Tech:** React 18, Vite, Tailwind. Dev server proxies `/api` → `localhost:3000`.

### Key components

- **`useEpubReader` (hook)**
  - Loads/opens EPUB (from file or Library).
  - Renders with **epub.js**; supports paginated or fixed-layout.
  - Calculates pages via a **probe renderer** to collect CFIs for page starts.
  - Tracks & persists:
    - `currentPage`, `totalPages`, `%progress`
    - **Last CFI** per book (IndexedDB `positions`) for accurate resume.
  - Exposes navigation (next/prev, goToPage, seekPercent), bookmarks, library ops.
  - **Tab-switch safe**: exposes `saveNow()` and `restoreLastLocation()` to handle showing/hiding the reader while preserving the exact spot.

- **Reader UI**
  - `ReaderPane` hosts the iframe for epub.js.
  - `ControlsBar` shows page X/Y, progress scrubber, Go-to-page, **Add bookmark**.
  - `HeaderBar` has **Upload EPUB**, theme toggle, and a search field (UX only).
  - **ToolsDrawer** opens when text is selected: generate/edit prompt, create image, save prompt.

- **Downloads**
  - Grid of generated images, lightbox preview, **Save** with smart filenames.

- **Saved**
  - Tabs for **Highlights**, **Bookmarks** (go/delete/export), **Prompts** (with source text).

- **Library**
  - Lists imported books (from IndexedDB).
  - Open → returns to Reader and **restores last position**.
  - Remove → deletes EPUB blob and its bookmarks bucket.

### Styles & UX skin
- Tailwind plus a retro skin in `styles.css`.
- **Reader section is never `display:none`**; instead we use a `.hidden-section` class (opacity 0, pointer-events none) so epub.js keeps stable layout and doesn’t fall back to Chapter 1.

---

## Setup & running locally

**Prereqs**
- Node.js 18+ (required for global `fetch`)
- npm (or pnpm/yarn)

### 1) Server
```bash
cd server
cp .env.example .env   # create and fill OPENAI_API_KEY, STABILITY_API_KEY
npm install
npm start              # http://localhost:3000
```

> If you don’t have `.env.example`, create `.env` with:
> ```
> OPENAI_API_KEY=sk-...
> STABILITY_API_KEY=...
> ```

### 2) Client
```bash
cd client
npm install
npm run dev            # http://localhost:5173 (proxy to :3000 for /api)
```

Open http://localhost:5173 and **Upload EPUB**.

---

## Key implementation details

### Exact-position resume (CFI)
- Per-book position saved in **IndexedDB `positions`** (`id`, `cfi`, `updatedAt`).
- Mirrored into `ss_library_v1` for the UI (shows “Has a saved position”).
- Hook prevents **overwriting** on initial resume:
  - If a resume CFI exists, the first `displayed` event **does not save**.
  - After the first `relocated`, saving re-enables.
- Reader visibility:
  - We **do not** remove or `display:none` the reader section; we fade it out with `.hidden-section` to prevent epub.js from reflowing to Chapter 1.
  - On return to Home, `restoreLastLocation()` calls `rendition.display(lastCFI)`.

### Page counting
- For reflowable books, a background **probe renderer** paginates each spine item at current viewport size, collecting the start **CFIs** per page to guarantee stable, integer page numbers and accurate seek.

### Bookmarks & highlights
- Bookmarks: per book (CFI, label, page range). Export to text file.
- Highlights: saved **verbatim** selections; stored globally with book and page metadata.

### Prompt & image generation
- **Generate Prompt**: deterministic-ish, concise, style-aware; optional **Regenerate** sets `bypassCache=true`.
- **Generate Image**: submits scene prompt + style to Stability; returns a `data:image/png;base64` URL. Users can **Save** with a smart filename:
  ```
  <book>_<page>_<style>_<YYYYMMDD-HHMM>.png
  ```

---

## Accessibility & i18n

- Uses semantic HTML where possible; still worth adding:
  - Landmarks (main, nav, header) & ARIA role polish.
  - Keyboard navigation for ToolsDrawer and lightbox (Esc, Tab traps).
  - Focus outlines & skip links.
  - Localized strings (extract UI text to a messages file).

---

## Security & privacy

- API keys live **only on the server**. Client never sees them.
- CORS is open in dev; consider restricting to known origins in production.
- No accounts yet; data is stored locally on the user’s device.
- Prompts may include user-provided text (book excerpts). They are sent to upstream providers only when the user requests prompt/image generation.

---

## Performance considerations

- **Server**
  - 1 hour **NodeCache** prevents repeated LLM & T2I calls.
  - Consider upstream timeouts and request size limits.
  - (Future) add rate limiting and request logging.

- **Client**
  - Large `data:` images live in localStorage → can grow quickly; consider migrating images to IndexedDB if users generate many (see Roadmap).
  - Probe pagination runs on size changes; debounced to avoid thrash.

---


## Roadmap

- **Model upgrades & configurability**
  - Switch to newer, cheaper LLMs; configurable model via `OPENAI_MODEL`.
  - Add negative prompts & seed control for images.

- **Image storage**
  - Move gallery images to **IndexedDB** with blob URLs; add export/import.

- **Prompt tooling**
  - Prompt templates & styles (e.g., watercolor/noir presets with camera, lens, lighting).

- **Reader enhancements**
  - TOC navigation, search inside book, “read aloud” (TTS), better selection markers.

- **Sync**
  - Optional cloud sync for positions/highlights/prompts (with auth).

- **Stability & monitoring**
  - Rate limiting, retries, structured logs, health check endpoint.

---

## Project structure

```
server/
  server.js            # Express app (OpenAI + Stability routes)
  package.json         # deps: express, cors, node-cache, dotenv

client/
  src/
    components/        # UI pieces: ReaderPane, ToolsDrawer, Downloads, etc.
    hooks/
      useEpubReader.js # EPUB load/render, pagination, CFI persistence, library ops
    lib/
      api.js           # /api fetch helpers
      db.js            # IndexedDB helper (books, positions)
      library.js       # Hashing & library operations
    App.jsx            # App shell & navigation
    styles.css         # Retro theme + layout
    main.jsx
  vite.config.js       # dev proxy /api → 3000
  tailwind.config.js
  package.json
```

