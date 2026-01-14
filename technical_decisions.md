# Technical Decisions & Architecture (Surgical Precision)

## 1. Core Architecture: Next.js + PWA
**Choice:** Next.js 14+ (App Router)
**Why:**
- **Hybrid Rendering:** We need fast static pages for SEO (landing page) but heavy Client-Side interactions for the Camera and Live Wall.
- **PWA Support:** Essential for the "Zero Download" requirement. Next.js handles service workers and manifest generation efficiently.
- **Routing:** App Router simplifies dynamic routes for events (`/event/[id]`) and live walls (`/live/[id]`).

## 2. Backend & Realtime: Supabase
**Choice:** Supabase (PostgreSQL + Realtime + Storage)
**Why:**
- **Instant Gratification (Realtime):** The "Live Wall" feature requires milliseconds latency. Supabase Realtime (Postgres Changes) pushes updates to the client via WebSockets automatically. No need for a custom WebSocket server.
- **Anonymous Uploads:** We need guests to upload without accounts. Supabase Auth supports anonymous sessions and RLS (Row Level Security) ensures they can only write, not read others' photos unless authorized.
- **Storage:** Direct upload to S3-backed storage from the client (skipping our server) is faster and cheaper.

## 3. Styling: Vanilla CSS (CSS Variables)
**Choice:** Native CSS with CSS Modules/Global Variables
**Why:**
- **Performance:** No runtime overhead, smaller bundle size than some CSS-in-JS libraries.
- **Maintainability:** Standard CSS is future-proof.
- **Control:** Allows "surgical" control over animations and transitions which are critical for the premium feel.

## 4. Offline Strategy
**Choice:** Service Worker + LocalStorage Queue
**Why:**
- Venues have bad reception.
- **Mechanism:** Photos are saved to IndexedDB/LocalStorage locally. A background sync (SyncManager) or a simple retry loop detects network recovery and flushes the queue.

## 5. Security (RLS)
**Policy:**
- `events`: Public read (for details).
- `photos`: Insert (public/anon). Select (Live Wall only, or by owner).
