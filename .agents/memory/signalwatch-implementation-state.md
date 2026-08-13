---
name: ViaX Trace implementation state
description: Tracks what has been built and what remains for ViaX Trace (antigo SignalWatch).
---

## What is done

### Backend (artifacts/api-server)
- Clerk middleware (`@clerk/express`) + proxy middleware for production
- `requireAuth` middleware — every protected route reads `req.userId` from Clerk
- All routes in `src/routes/signalwatch.ts`, isolated by `clerkUserId`
- Mercado Pago adapter via raw fetch; token from `MERCADOPAGO_ACCESS_TOKEN` env secret
- Telegram connector real: `src/lib/telegramService.ts` — QR code auth, session encryption (AES-256-GCM), message listener, group sync, session restore on startup
- Admin detection: `SIGNALWATCH_ADMIN_EMAILS` env var → Clerk API lookup → `isAdmin=true` + `planId='admin'` (unlimited)
- `bufferutil` and `utf-8-validate` added as direct deps of api-server to fix pnpm resolution issue
- `pnpm.onlyBuiltDependencies` set in root package.json for bufferutil, utf-8-validate, @clerk/shared, es5-ext
- SSE endpoints: `POST /api/connection/events/auth` (nonce), `GET /api/connection/events` (stream QR/connected/needs_2fa/error events)
- 2FA: `POST /api/connection/2fa` resolves pending password callback from GramJS
- Profile: `POST /api/profile/name` → Clerk Management API PATCH
- Sessions: `GET /api/profile/sessions` → Clerk Management API (active sessions with IP, city, browser, device)
- Support: `POST /api/support/report` → structured JSON log
- Audit logging middleware: every authenticated request logs userId, method, route, IP, timestamp as JSON to stdout
- Auth for all manual fetch calls: cookie-based (credentials: 'same-origin'), NOT Bearer token — clerkMiddleware reads session cookies

### Database (lib/db)
Tables with all columns migrated to dev PostgreSQL:
- `signalwatch_profiles` — `isAdmin boolean` column added
- `signalwatch_groups`, `signalwatch_rules`, `signalwatch_alerts`, `signalwatch_connections`, `signalwatch_checkouts`

### Frontend (artifacts/signalwatch)
- Real Clerk auth: `ClerkProvider` wrapping app, `SignIn`/`SignUp` Clerk components at `/sign-in` and `/sign-up`
- `ProtectedRoute` redirects to `/sign-in` when signed out; home redirects to `/app` when signed in
- `AppShell` uses `useUser()` for name/avatar, `useClerk().signOut()` for logout button; date header is dynamic
- Clerk appearance: teal theme with SignalWatch brand colors, logo at `public/logo.svg`
- Clerk localization: PT-BR titles ("Bem-vindo de volta.", "Crie seu radar.")
- Session cache invalidation via `ClerkQueryClientCacheInvalidator`
- ConnectionPage: SSE-driven QR updates (no polling), real-time countdown timer, 2FA modal overlay
- Clerk layer declared in index.css before tailwindcss import
- vite.config.ts: `tailwindcss({ optimize: false })` to prevent Clerk styles breaking in prod
- Font: Poppins (body) + Space Grotesk (display headings) + DM Mono
- Logo: SVG waveform with teal background + gold peak dot (updated in both public/logo.svg and React components)
- Landing.tsx: completely redesigned — trust/credibility/regulatory focus; no sales pressure; sections: Hero, Metodologia, Como funciona, Conformidade, Documentação; footer: © 2026
- AlertRow: "Abrir no Telegram" link shown when `alert.messageLink` is non-null
- SettingsPage: 4 tabs — Preferências, Perfil (photo upload + name edit), Dispositivos (active sessions), Suporte (report problem + docs)

### Secrets configured
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET` — active
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — active (real user credentials)
- `SIGNALWATCH_ADMIN_EMAILS` — set to admin email for unlimited access
- `MERCADOPAGO_ACCESS_TOKEN` — NOT YET set, user will provide later

## What remains

1. **Mercado Pago** — wired but disabled until `MERCADOPAGO_ACCESS_TOKEN` is set.
2. **Production DB migration** — after deploy, run `pnpm --filter @workspace/db run push` against prod DB.
3. **messageLink population** — backend listener needs to set `messageLink` on alerts so "Abrir no Telegram" button actually appears.

## Key quirks / non-obvious decisions

- `bufferutil`/`utf-8-validate` are in esbuild `external[]` list AND must be direct deps of api-server (pnpm won't hoist otherwise) — both conditions required.
- Root `package.json` must have `pnpm.onlyBuiltDependencies` to allow native module build scripts.
- Clerk `publishableKeyFromHost` from `@clerk/react/internal` — never the raw env var directly.
- Telegram QR auth: SSE stream pushes QR images every ~25s automatically. Frontend opens SSE after `POST /connection/events/auth` returns a nonce (30s TTL, single-use).
- Manual fetch calls (profile/name, connection/2fa, support/report, profile/sessions) must use `credentials: 'same-origin'` and NO Bearer token — Clerk reads session cookie. Using `user?.getToken()` + Bearer header fails on Replit-managed instances.
- Admin plan `id='admin'` is not in `BILLING_PLANS` array — `getBillingPlan()` handles it separately.
- `requireAuth` in auth.ts is the middleware itself (not a factory) — pass it as `requireAuth`, never call it as `requireAuth()`.
