# LUCE — Technical Requirements Document (TRD)

**Product:** LUCE  
**Version:** 1.0  
**Date:** October 2026  
**Aligned to:** PRD v2.0

---

## 1. Purpose

This TRD defines the technical architecture, stack, services, quality controls (logging, errors, unit testing), hosting, email, version control, and DNS for the LUCE MVP.

---

## 2. Technology Stack

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | **Next.js** (App Router, React, TypeScript) | Marketing site + authenticated app UI |
| Backend | **Node.js** (Next.js Route Handlers / API routes + optional Nest/Express workers) | Auth session helpers, campaign orchestration, webhooks, ZIP assembly |
| Database | **Firebase Firestore** | Users, products, campaigns, strategy, usage |
| Auth | **Firebase Authentication** | Email + **Google (Gmail) sign-in** |
| File / blob storage | **Firebase Storage** | Product source images, generated assets, ZIP exports |
| Email | **Resend** | Welcome, verify, plan receipts, export-ready, error digests (ops) |
| Hosting | **Vercel** | Next.js production + preview deployments |
| Version control | **Git** (+ GitHub remote) | Source control, PRs, CI |
| DNS / domain | **A / CNAME records** | Point custom domain to Vercel |

### 2.1 Why this stack

- **Next.js + Vercel:** SSR/SSG for landing SEO; API routes for MVP orchestration; edge/CDN delivery.  
- **Firebase:** Auth + Firestore + Storage in one security-rules model; fits PRD storage flow.  
- **Node.js:** ZIP packaging, webhook handlers, AI provider calls, Resend.  
- **Resend:** Simple transactional email for auth and plan events.  
- **Git:** Required academic / team version control.

---

## 3. High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Next.js (UI)   │────▶│  Node API layer  │────▶│  AI providers       │
│  App Router     │     │  (Route Handlers)│     │  (vision / gen)     │
└────────┬────────┘     └────────┬─────────┘     └─────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ Firebase Auth   │     │ Firestore        │
└─────────────────┘     │ Firebase Storage │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │ Resend (email)   │
                        └──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │ Vercel Hosting   │
                        └──────────────────┘
```

**Campaign Agent (logical):** orchestration layer that sequences product understanding → questions → research → strategy → generation. Users see one workflow; models are internal.

---

## 4. Environments

| Env | Purpose | Hosting |
|-----|---------|---------|
| `local` | Developer machines | `next dev` |
| `preview` | PR previews | Vercel Preview |
| `production` | Live users | Vercel Production + custom domain |

Secrets via Vercel Environment Variables / `.env.local` (never commit).

---

## 5. Backend Responsibilities (Node.js)

1. Validate Firebase ID tokens on protected routes  
2. Product URL scrape / normalize + image ingest  
3. Call AI services (understanding, research, strategy, image/video/text)  
4. Enforce plan limits before generation  
5. Persist documents to Firestore; upload blobs to Storage  
6. Assemble campaign ZIP; signed download URLs  
7. Send Resend emails on auth / plan / export events  
8. Structured logging + error mapping  

---

## 6. Logging

**Goal:** Trace every campaign job end-to-end for debugging and academic evaluation.

| Requirement | Detail |
|-------------|--------|
| Format | Structured JSON logs (timestamp, level, requestId, userId, campaignId, module, message, meta) |
| Levels | `debug`, `info`, `warn`, `error` |
| Correlation | `requestId` / `jobId` on every Agent step |
| Modules tagged | `auth`, `clipping`, `transcribe`, `plans`, `campaign`, `storage`, `email` |
| Where | Server stdout → Vercel logs; optional export to file sink for demos |
| PII | Do not log passwords, raw tokens, or full card data; redact emails partially in prod |

**Example log event**

```json
{
  "ts": "2026-10-09T12:00:00.000Z",
  "level": "info",
  "module": "clipping",
  "requestId": "req_abc",
  "userId": "uid_123",
  "campaignId": "cmp_456",
  "message": "UGC clip generation started",
  "meta": { "assetType": "ugc_short", "plan": "starter" }
}
```

---

## 7. Error Handling

| Class | HTTP / UX | Behavior |
|-------|-----------|----------|
| Validation | 400 | Field-level messages; no job start |
| Auth | 401 / 403 | Login redirect / plan upgrade CTA |
| Upstream AI | 502 / 503 | Retry with backoff; user-facing “retry generation” |
| Storage | 500 | Log + toast; do not mark campaign complete |
| Plan limit | 402 / 403 | Clear Free vs Starter messaging |
| URL scrape fail | 422 | Offer manual upload path |

**Principles**

- Never expose stack traces to the client in production  
- Map errors to stable `error.code` values for UI copy  
- Failed generations leave campaign in `partial` / `failed` with retry  
- Critical failures can trigger Resend ops alert (optional)

---

## 8. Unit Testing (evaluation weight)

Academic note: **Logging + Error Handling + Unit Testing** form a combined quality pillar (target **7** evaluation points: e.g. basics **2** + depth **5**, or error path **3** + tests **5**, consolidated to **7**).

### 8.1 Framework

- **Jest** or **Vitest** for unit tests  
- **React Testing Library** for critical UI units  
- Optional **Playwright** smoke for E2E milestones (see Milestone — Testing)

### 8.2 Minimum coverage targets (MVP)

| Area | Examples | Target |
|------|----------|--------|
| Auth helpers | Token verify mock, session gate | ≥ 80% lines on helpers |
| Plan limits | Free monthly quota math | 100% of limit rules |
| Transcribe / extract | Product field normalize, missing-field detection | Core pure functions 100% |
| Clipping job mapper | Asset type → pipeline config | Happy + invalid type |
| Error mapper | Internal error → public code | All mapped codes |
| ZIP manifest builder | Folder structure for export | Snapshot test |

### 8.3 CI

On every PR: `lint` → `unit test` → `build`. Vercel deploy proceeds only if build succeeds; tests run in GitHub Actions or `vercel` build step.

---

## 9. Hosting — Vercel

| Item | Spec |
|------|------|
| Framework preset | Next.js |
| Build | `next build` |
| Node | 20.x or 22.x LTS |
| Regions | Default (e.g. iad1) unless latency requires change |
| Previews | One URL per PR |
| Production URL | `luce-landing.vercel.app` (interim) → custom domain |

---

## 10. Email — Resend

| Trigger | Template |
|---------|----------|
| Google / email signup | Welcome to LUCE |
| Campaign ZIP ready | Your campaign is ready to download |
| Plan upgrade | Starter / Paid confirmation |
| Limit reached | Free plan limit notice |

Secrets: `RESEND_API_KEY`, `EMAIL_FROM` (verified domain).

---

## 11. Version Control — Git

| Practice | Rule |
|----------|------|
| Main branch | `main` (protected) |
| Feature branches | `feat/auth`, `feat/clipping`, etc. |
| Commits | Conventional, small, reviewed |
| PR | Required before merge to `main` |
| Ignore | `.env*`, `node_modules`, build artifacts |

---

## 12. DNS / Domain (A record update)

| Step | Action |
|------|--------|
| 1 | Purchase / use domain (e.g. `luce.ai` or project domain) |
| 2 | In Vercel → Project → Domains → Add domain |
| 3 | At DNS provider: add **A** record(s) and/or **CNAME** as Vercel instructs |
| 4 | Wait for SSL (Vercel issues certificate) |
| 5 | Verify `https://yourdomain` serves production |

Document the exact A/CNAME values in the handoff sheet after Vercel assigns them (values change per account).

---

## 13. Security Requirements

- Firebase Auth only for identity  
- Firestore / Storage **Security Rules** enforce `request.auth.uid == resource.data.userId`  
- Server Admin SDK for privileged writes  
- HTTPS only  
- Signed URLs for ZIP downloads with expiry  
- Rate-limit generation endpoints per user  

---

## 14. Performance & Limits (MVP)

| Concern | Guidance |
|---------|----------|
| Page TTFB | Landing static/ISR preferred |
| Generation | Async jobs; poll or listen for status |
| Video assets | Store in Firebase Storage; stream via signed URL |
| Max concurrent jobs | Plan-based (Free: 1; Paid: higher) |

---

## 15. Module Map (implements Implementation Plan)

| Module | Tech touchpoints |
|--------|------------------|
| Auth (Gmail) | Firebase Auth Google provider + Next.js session |
| Clipping | Node jobs → video/UGC generation → Storage |
| Transcribe | Product page / speech / caption text extraction → Firestore |
| Plans / Paid | Firestore `plans` + usage counters + Resend receipts |

---

## 16. Compliance / Academic Deliverables Checklist

- [x] Stack documented (Firebase, Next.js, Node.js, Vercel, Resend, Git, DNS)  
- [x] Logging strategy  
- [x] Error handling strategy  
- [x] Unit testing strategy (7-point quality pillar)  
- [x] Hosting + email + VCS + DNS  

---

*End of TRD v1.0*
