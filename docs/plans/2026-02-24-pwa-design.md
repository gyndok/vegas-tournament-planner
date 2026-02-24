# PWA (Progressive Web App) Design

## Goal

Turn NextRebuy into an installable PWA so players can add it to their homescreen and view their tournament schedule offline at the casino.

## What Already Exists

- `public/manifest.json` with name, icons (192 & 512), `display: standalone`
- `public/apple-touch-icon.png`, favicon files
- Layout metadata references the manifest

## What We're Adding

### 1. Service Worker (`public/sw.js`)

Hand-written, no library dependencies. ~50 lines.

**Caching strategy:** Network-first with cache fallback for `/api/schedule`. On every schedule fetch, the SW intercepts the request, tries the network, and if successful, stores the response in a cache called `schedule-cache`. If offline (network fails), it serves the cached response.

Also caches the app shell HTML so the schedule page loads offline.

Uses a `CACHE_VERSION` constant for cache busting on deploy.

### 2. Service Worker Registration

A client component `<ServiceWorkerRegistration />` in the root layout that calls `navigator.serviceWorker.register('/sw.js')` on mount. Only registers if `'serviceWorker' in navigator`.

### 3. Install Banner (`<InstallPrompt />`)

A client component rendered in the root layout.

- Listens for `beforeinstallprompt` event, stores it
- Shows a dismissable bottom banner on mobile: "Add NextRebuy to your homescreen for quick access to your schedule, even offline"
- "Install" button triggers the stored prompt
- "Dismiss" hides the banner, stores flag in `localStorage` so it doesn't reappear
- Only shows when NOT already in standalone mode

### 4. Offline Indicator

A small banner at the top of the schedule page when `navigator.onLine === false`: "You're offline — showing your last saved schedule". Disappears when connectivity returns via `online`/`offline` events.

### 5. Manifest

No changes needed — already correct.

## Files to Create/Modify

- `public/sw.js` — new service worker
- `src/components/sw-registration.tsx` — new client component
- `src/components/install-prompt.tsx` — new client component
- `src/components/offline-indicator.tsx` — new client component
- `src/app/layout.tsx` — add SW registration + install prompt
- `src/app/schedule/page.tsx` — add offline indicator

## Non-Goals

- No full offline app (only schedule data cached)
- No push notifications (future feature)
- No background sync
