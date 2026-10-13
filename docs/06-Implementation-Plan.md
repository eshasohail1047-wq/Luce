# LUCE — Implementation Plan

**Version:** 1.0  
**Date:** October 2026  
**Stack:** Next.js · Node.js · Firebase · Resend · Vercel · Git  

---

## 1. Objectives

Deliver the LUCE MVP in phased modules that match academic checkpoints and PRD scope:

1. **Auth Module** — Gmail / Google enable  
2. **Clipping Module** — short-form / UGC video clip generation  
3. **Transcribe Module** — product extraction + caption / text pipeline  
4. **Plans / Paid Plans** — Free vs Starter (and Pro) entitlements  

Cross-cutting every phase: **logging, error handling, unit tests**, Git commits, Vercel deploys.

---

## 2. Phase Overview

| Phase | Module | Duration (suggest) | Outcome |
|-------|--------|--------------------|---------|
| 0 | Foundation | 1 week | Next.js app, Firebase project, Vercel, GitHub, DNS plan |
| 1 | Auth (Gmail) | 1–1.5 weeks | Sign-in, session, user doc, Resend welcome |
| 2 | Transcribe | 1.5–2 weeks | URL/upload → structured product → confirm UI |
| 3 | Clipping | 2 weeks | UGC/video clip jobs + Storage + results preview |
| 4 | Campaign core | 2 weeks | Research, strategy, stills/social/ads orchestration |
| 5 | Plans / Paid | 1–1.5 weeks | Quotas, billing UI, upgrade emails |
| 6 | Hardening | 1 week | Logging/errors/tests, ZIP export, DNS cutover |

Phases 2–3 can partially overlap after Auth is stable.

---

## 3. Phase 0 — Foundation

**Tasks**

- [ ] Create Next.js (TypeScript) app structure (marketing `/` + `/app` routes)  
- [ ] Connect GitHub repo; protect `main`  
- [ ] Create Firebase project (Auth, Firestore, Storage)  
- [ ] Configure Vercel project + env vars  
- [ ] Document DNS A/CNAME steps for custom domain  
- [ ] Add base logger utility + error code map  
- [ ] CI: lint + unit test + build  

**Exit criteria:** Preview deploy succeeds; empty authenticated shell loads.

---

## 4. Phase 1 — Auth Module (Gmail Enable)

**Goal:** Users sign in with **Google (Gmail)** and optional email/password.

**Tasks**

- [ ] Enable Google provider in Firebase Auth  
- [ ] `/login`, `/signup` UI (brand-aligned)  
- [ ] Persist `users/{uid}` on first login (`plan: free`)  
- [ ] Protect `/dashboard` and campaign routes  
- [ ] Resend welcome email  
- [ ] Unit tests: auth helper mocks, route guard  
- [ ] Logs: `module=auth` login success/fail  

**Exit criteria:** Google login → dashboard; logout clears session; unauthorized API returns 401.

---

## 5. Phase 2 — Transcribe Module

**Goal:** Turn product URL or images into confirmed structured product data (and later video captions).

**Tasks**

- [ ] API: ingest URL or multipart images  
- [ ] Extract/normalize name, description, features, category, price, images  
- [ ] Missing-field detector + smart questions seed  
- [ ] Confirm product UI (`/campaigns/[id]/confirm`)  
- [ ] Save `products/{id}` + source blobs  
- [ ] Unit tests: normalize, missing fields, error codes for bad URL  
- [ ] Logs: `module=transcribe` start/success/fail with `requestId`  

**Exit criteria:** User can confirm a product from URL or upload; invalid URL offers manual path.

---

## 6. Phase 3 — Clipping Module

**Goal:** Generate product-faithful short video / UGC-style clips into Storage and attach to campaign.

**Tasks**

- [ ] Job enqueue for `ugc_video` / `reels_video` / `marketing_video`  
- [ ] Node worker/route calls video generation provider  
- [ ] Write MP4 + thumbnail to Storage; `assets` docs  
- [ ] Results UI preview + regenerate  
- [ ] Enforce fidelity constraints in prompts (change scene, not product)  
- [ ] Unit tests: job mapper, status transitions, plan gate stub  
- [ ] Logs: `module=clipping` per attempt  

**Exit criteria:** At least one clip type generates, plays in results, stores under user path.

---

## 7. Phase 4 — Campaign Core (Research → Strategy → Full pack)

**Goal:** Complete PRD loop beyond clipping/transcribe.

**Tasks**

- [ ] Research summary generation + display  
- [ ] Strategy document generation + approve  
- [ ] Still visuals + social copy + ad creative pipelines  
- [ ] Progress UI stages (PRD list)  
- [ ] ZIP export (`exports/campaign.zip`) + download page  
- [ ] Dashboard list of campaigns  

**Exit criteria:** End-to-end Free user path: create → confirm → generate → download.

---

## 8. Phase 5 — Plans / Paid Plans

**Goal:** Enforce Free vs Starter (and Pro) per PRD.

**Tasks**

- [ ] Plan catalog in config + `users.plan`  
- [ ] `usage/{uid}_{yyyy_mm}` counters  
- [ ] Server-side block when over limit  
- [ ] `/billing` UI + upgrade CTAs  
- [ ] Resend: upgrade confirmation + limit notice  
- [ ] Gate Agent refine to Starter+  
- [ ] Unit tests: quota math 100%  

**Exit criteria:** Free user blocked at limit with clear upgrade path; Starter can refine.

---

## 9. Phase 6 — Hardening & Launch

**Tasks**

- [ ] Structured logging review across modules  
- [ ] Error UX pass + retry buttons  
- [ ] Unit test suite green in CI (≥ agreed coverage)  
- [ ] Security rules review (Firestore + Storage)  
- [ ] Custom domain A-record cutover + SSL verify  
- [ ] Production smoke on Vercel  

---

## 10. Team / Role Split (suggested)

| Role | Focus |
|------|-------|
| Frontend | Next.js pages, design system, progress UX |
| Backend | Node APIs, jobs, ZIP, Resend |
| Firebase | Rules, indexes, Auth providers |
| QA | Unit + milestone test plan (doc 07) |

---

## 11. Risk Register

| Risk | Mitigation |
|------|------------|
| AI product distortion | Confirm step + fidelity prompts + reject bad outputs |
| Long video gen times | Async jobs + progress states |
| Cost overruns | Plan quotas + rate limits |
| URL scrape blocks | Manual upload fallback |
| DNS delay | Keep `*.vercel.app` until A-record propagates |

---

## 12. Definition of Done (per phase)

- Feature merged via PR  
- Unit tests for new pure logic  
- Logs + errors wired  
- Preview deploy verified  
- PRD acceptance notes updated  

---

*End of Implementation Plan v1.0*
