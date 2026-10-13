# LUCE — Milestone: Testing

**Version:** 1.0  
**Date:** October 2026  
**Related:** TRD §6–8 · Implementation Plan phases  

Academic note: **Logging + Error Handling + Unit Testing** are treated as a combined quality milestone worth approximately **7** evaluation points (e.g. foundation **2** + execution **5**, or errors **3** + tests **5**, consolidated to **7**).

---

## 1. Testing Objectives

1. Prove each module (Auth, Transcribe, Clipping, Plans) works against PRD acceptance  
2. Demonstrate **structured logging** and **graceful errors**  
3. Maintain a **unit test suite** that runs in CI  
4. Provide a repeatable **milestone checklist** for supervisor review  

---

## 2. Test Levels

| Level | Tooling | Scope |
|-------|---------|-------|
| Unit | Vitest / Jest | Pure functions, mappers, quotas, error codes |
| Component | React Testing Library | Login CTA, confirm form, plan gate UI |
| Integration | API tests + Firebase emulator (preferred) | Auth → create product → job status |
| E2E smoke | Playwright (optional MVP+) | Happy path on preview URL |
| Manual / UAT | Checklist below | Supervisor demo |

---

## 3. Milestone M0 — Test Foundation (2 pts)

| ID | Criterion | Pass |
|----|-----------|------|
| M0.1 | Test runner configured (`npm test`) | ☐ |
| M0.2 | CI runs tests on PR | ☐ |
| M0.3 | Logger utility emits JSON with `module`, `requestId` | ☐ |
| M0.4 | Central `error.code` map exists | ☐ |

---

## 4. Milestone M1 — Auth Module

| ID | Case | Type | Expected |
|----|------|------|----------|
| A1 | Google sign-in success | Manual / E2E | Lands on `/dashboard`; `users` doc created |
| A2 | Unauthenticated API call | Unit / Integration | 401 |
| A3 | Protected page redirect | Component | Redirect `/login` |
| A4 | Welcome email queued | Integration (mock Resend) | `module=email` log |
| A5 | Logout | Manual | Session cleared |

**Logging checks:** `module=auth` info on success; warn/error on fail without token leak.

---

## 5. Milestone M2 — Transcribe Module

| ID | Case | Type | Expected |
|----|------|------|----------|
| T1 | Valid product URL extract | Integration | Fields populated |
| T2 | Invalid / blocked URL | Unit + API | 422 + manual upload path |
| T3 | Image-only upload | Manual | Agent asks missing fields |
| T4 | Confirm edits persist | Integration | Firestore updated |
| T5 | Normalize empty strings | Unit | Missing-field list correct |

**Error checks:** User sees actionable message; server log has `campaignId` / `requestId`.

---

## 6. Milestone M3 — Clipping Module

| ID | Case | Type | Expected |
|----|------|------|----------|
| C1 | Enqueue UGC clip | Integration | `jobs` + `assets` status `queued→ready` |
| C2 | Preview playback | Manual | Video plays from signed URL |
| C3 | Regenerate clip | Manual / API | New asset version; old retained or replaced per rules |
| C4 | Provider failure | Unit (mock) | Status `failed`; retry allowed |
| C5 | Fidelity prompt includes product constraints | Unit | Prompt builder snapshot |

**Logging checks:** start / success / fail events with attempt count.

---

## 7. Milestone M4 — Plans / Paid Plans

| ID | Case | Type | Expected |
|----|------|------|----------|
| P1 | Free quota allows first campaign | Unit | `true` |
| P2 | Free quota blocks second (same month) | Unit | `false` + code `PLAN_LIMIT` |
| P3 | Starter can open refine | Manual | Route accessible |
| P4 | Free cannot Agent-refine | Manual / API | 403 + upgrade CTA |
| P5 | Upgrade updates `users.plan` | Integration | Plan `starter`; Resend mock |

---

## 8. Milestone M5 — End-to-End Campaign (UAT)

| Step | Action | Pass |
|------|--------|------|
| 1 | Sign in with Google | ☐ |
| 2 | Create campaign + add product | ☐ |
| 3 | Confirm product | ☐ |
| 4 | Research + strategy visible | ☐ |
| 5 | Generate (includes clipping + copy) | ☐ |
| 6 | Preview grouped results | ☐ |
| 7 | Download ZIP | ☐ |
| 8 | Revisit campaign on dashboard | ☐ |
| 9 | Confirm manual-publish messaging shown | ☐ |

**Success = PRD success criteria sample** for supervisor demo.

---

## 9. Unit Testing Matrix (5 pts depth)

| Module | Must-have unit tests | Owner |
|--------|----------------------|-------|
| Auth | Token presence helper; role/plan read | Backend |
| Transcribe | Field normalize; missing fields; URL validate | Backend |
| Clipping | Asset type → pipeline; status machine | Backend |
| Plans | Monthly quota; entitlement flags | Backend |
| Errors | Internal → public code mapping | Shared |
| Export | ZIP manifest structure snapshot | Backend |

**Coverage target:** critical pure modules ≥ 80%; plan math 100%.

---

## 10. Logging & Error Demo Script (for viva / marks)

1. Trigger a **failed URL scrape** → show UI error + Vercel/server log line with `module=transcribe`, `level=error`, `requestId`.  
2. Trigger a **plan limit** → show `PLAN_LIMIT` + upgrade CTA + `module=plans` warn log.  
3. Run `npm test` → show green suite including quota + error mapper tests.  

This script is designed to evidence the **7-point** quality pillar clearly.

---

## 11. Bug Severity for Milestone Sign-off

| Severity | Example | Blocks milestone? |
|----------|---------|-------------------|
| S1 | Auth broken; data leak | Yes |
| S2 | Generation never completes; ZIP corrupt | Yes |
| S3 | UI copy wrong; slow preview | No (track) |
| S4 | Cosmetic | No |

---

## 12. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Supervisor / Sir | | | |

**Milestone result:** ☐ Pass · ☐ Pass with conditions · ☐ Fail  

**Conditions / notes:**

_______________________________________________

_______________________________________________

---

*End of Milestone — Testing v1.0*
