# LUCE — Product Requirements Document (PRD)

**Product:** LUCE — Bring Your Product to Light.  
**Document type:** MVP Product Specification  
**Version:** 2.0  
**Date:** October 2026  
**Status:** Approved for MVP build

---

## 1. Executive Summary

LUCE is an AI-powered campaign creation platform for Shopify, e-commerce, and DTC physical-product brands. The user provides a **product URL** or **product images** plus basic information. LUCE understands the product, researches market context, builds a campaign strategy, and generates a **complete marketing campaign** around that single product.

### Core concept

> **One product → One research-backed campaign → Everything needed to market it.**

### Brand

| Item | Definition |
|------|------------|
| Brand | LUCE |
| Meaning | Italian for “Light.” |
| Tagline | LUCE — Bring Your Product to Light. |
| Visible product line | Give LUCE one product. Get everything you need to market it. |
| Supporting line | LUCE transforms one real product into a research-backed marketing campaign — from product visuals and videos to social content, ad creatives and campaign strategy. |

---

## 2. MVP Scope (read first)

| In MVP | Out of MVP (future) |
|--------|---------------------|
| Physical products (Shopify / DTC) | Automatic social publishing |
| Research + strategy + asset generation | Scheduling & content calendar |
| Dashboard, storage, ZIP download | Analytics & optimization |
| Manual publishing only | SaaS / digital-product workflows |
| Plan limits (Free / Starter+) | Multi-provider marketplace UI |

---

## 3. MVP Workflow — Primary Product Flow

| Step | Stage | What happens |
|------|-------|--------------|
| 01 | Create campaign | Start a new campaign |
| 02 | Add product | Paste product URL **or** upload image(s) + basic info |
| 03 | Product understanding | Extract/organize name, description, features, category, price, images, brand info |
| 04 | Confirm product | User reviews, edits, confirms |
| 05 | Research & discovery | Market, competitors, trends; smart questions; audience/positioning recommendations |
| 06 | Build campaign strategy | Objective, audience, insight, positioning, angle, message, creative direction, CTA |
| 07 | Generate campaign | Full campaign or selected asset types |
| 08 | Review results | Grouped: visuals, videos, social, ads, strategy |
| 09 | Refine | Preview, regenerate, Agent refine (plan-gated) |
| 10 | Download campaign | Complete ZIP package |
| 11 | Manual publishing | User posts manually (no auto-publish in MVP) |

---

## 4. MVP Deliverables

| Category | MVP output |
|----------|------------|
| Product visuals | Professional product image; lifestyle image; promotional creative |
| Videos | UGC-style short; Reels/social; product marketing video |
| Social content | Captions; hooks; CTAs; hashtags |
| Advertising | Ad creative; ad copy |
| Campaign strategy | Objective, audience, positioning, message, creative direction, CTA |
| Research | Market, competitor, trend / opportunity research |
| Campaign management | Dashboard; cloud storage; saved campaigns |
| Controls | Preview; regenerate; copy text; Agent refinement (eligible plans) |
| Export | Download complete campaign as ZIP |
| Publishing | Manual only |

---

## 5. Problem Statement

Small e-commerce and DTC brands often have a product but lack professional photography, video, UGC creators, designers, copywriters, or time. Using multiple AI tools creates a **fragmented workflow**.

**Critical problem — AI product distortion:** generated visuals may change bottle shape, logo, label, packaging, colors, and proportions.

**Strategic problem — disconnected content:** individual assets may look good but fail to share one audience, message, and objective.

---

## 6. Solution

LUCE treats the **real product as the source of truth**. The Campaign Agent understands the product, asks only necessary questions, researches context, builds strategy, and generates assets in one shared campaign context.

**Core workflow:** `PRODUCT → RESEARCH → STRATEGY → COMPLETE CAMPAIGN`

---

## 7. Target Audience (MVP)

Primary: small Shopify / e-commerce / DTC physical-product brands that need regular social content without a full creative team.

Categories: Beauty · Skincare · Perfume · Jewelry · Fashion accessories · Home & lifestyle · Food / consumer packaging · Small consumer brands.

---

## 8. User Input & Product Confirmation

**Option A — Product URL:** name, description, features, category, price, images, brand info.  
**Option B — Manual upload:** images + name, description, features; optional audience / brand tone.

Before generation, LUCE shows **“We found your product”** for review/edit/confirm to reduce incorrect claims and distortion.

---

## 9. Campaign Builder & Agent

Users choose full campaign or individual asset groups. The Campaign Agent:

- Understands product and goal  
- Asks only material questions  
- Recommends audience/positioning when unknown  
- Keeps strategy and assets on one shared context  
- Allows natural-language refine on eligible plans (“make it more premium”)

---

## 10. Progress UI States

1. Understanding product  
2. Researching market and competitors  
3. Building campaign strategy  
4. Preparing creative direction  
5. Generating selected assets  
6. Saving campaign  

Failures show clear messages and retry where appropriate.

---

## 11. Product Fidelity & Consistency

**Principle:** Change the scene, not the product.  
Preserve shape, proportions, logo, label, packaging, colors, and recognizable details.  
All assets share confirmed product info, strategy, audience, positioning, and message.

---

## 12. Storage Concept

`USER → PRODUCT → CAMPAIGN → STRATEGY / RESEARCH → ASSETS → DASHBOARD → DOWNLOAD`

- **Users:** account and plan  
- **Products:** confirmed details and source images  
- **Campaigns:** goals, research, strategy, context  
- **Assets:** images, videos, text  
- **Usage:** campaign count and plan limits  

Database / storage foundation: **Firebase** (see Schema & TRD).

---

## 13. Functional Requirements (summary)

| ID | Requirement |
|----|-------------|
| FR-01 | Product URL or manual upload |
| FR-02 | Product understanding |
| FR-03 | Product confirmation |
| FR-04 | Smart questions |
| FR-05 | Research |
| FR-06 | Campaign strategy |
| FR-07 | Campaign generation |
| FR-08 | Product fidelity |
| FR-09 | Results & refinement |
| FR-10 | Agent interaction (plan-gated) |
| FR-11 | Storage |
| FR-12 | ZIP export |
| FR-13 | Plan limits |
| FR-14 | Manual publishing messaging |

---

## 14. Non-Functional Requirements

- Beginner-friendly UX; confirm product before generate  
- Shared campaign context across assets  
- Clear progress, errors, retry  
- Persistent save / revisit  
- Predictable ZIP structure  
- Graceful URL failures + manual correction  
- Evidence-informed research (no fabricated facts)  
- Account-level ACL and plan enforcement  

---

## 15. Success Criteria

- Beginner can create a campaign without technical knowledge  
- Product reviewed before generation  
- Useful strategy + research summary delivered  
- Assets clearly belong to same product  
- Product remains recognizable  
- Individual regenerate works  
- Starter can refine via Agent  
- Save, revisit, download work  
- Workflow simpler than multi-tool stacks  

---

## 16. MVP vs Future

| Feature | MVP | Future |
|---------|-----|--------|
| Physical product input | Yes | Broader coverage |
| Research / strategy | Yes | Deeper monitoring |
| Images / video / social / ads | Selected outputs | More formats |
| Storage + ZIP | Yes | More export options |
| Conversational Agent | Starter refine | Advanced workflows |
| Social publish / schedule | No | Yes |
| Analytics / optimization | No | Yes |
| SaaS / digital products | No | Evaluate later |

---

## 17. Key Differentiator

LUCE is **not** “another AI image/video tool.” Positioning:

1. Research-first  
2. Complete coordinated campaign  
3. Product fidelity  
4. Campaign consistency  
5. One connected workflow  

### One-sentence definition

> LUCE turns one real product into a research-backed, complete marketing campaign through one simple AI-powered workflow.

---

## 18. Long-Term Vision

`PRODUCT → RESEARCH → STRATEGY → CAMPAIGN → CONNECT SOCIAL → SCHEDULE → PUBLISH → ANALYZE → IMPROVE`

---

*End of PRD v2.0*
