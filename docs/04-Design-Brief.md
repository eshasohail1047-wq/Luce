# LUCE — Design Brief / Brand Kit

**Version:** 1.0  
**Date:** October 2026  
**Sources:** PRD brand section + current landing visual system (`src/App.css`, fonts, Logo)

---

## 1. Brand Overview

| Element | Spec |
|---------|------|
| Brand name | **LUCE** |
| Meaning | Italian for “Light” |
| Tagline | Bring Your Product to Light. |
| Product line | Give LUCE one product. Get everything you need to market it. |
| Personality | Clear, premium, calm confidence — beauty/DTC studio energy without clutter |
| Promise | Research-backed, product-faithful campaigns in one workflow |

**Positioning (not just another generator):** connected Product → Research → Strategy → Campaign.

---

## 2. Logo

| Item | Guidance |
|------|----------|
| Wordmark | **LUCE** — bold geometric display, high letter recognition |
| Icon (optional) | Soft light / lens / flare motif; keep simple for favicon |
| Clear space | ≥ 0.5× cap-height around wordmark |
| Min size | Digital ≥ 88px wide wordmark; favicon 32×32 |
| Don’t | Stretch, outline-only on busy photos, purple glow stacks, emoji |

Current implementation: React `Logo` component on landing nav / footer giant mark.

---

## 3. Color System

### 3.1 Core palette (landing tokens)

| Token | Role | Approx. value / usage |
|-------|------|------------------------|
| `--ink` | Primary text | Near-black charcoal |
| `--ink-soft` | Secondary text | Soft charcoal |
| `--muted` / `--muted-soft` | Supporting copy | Cool gray-violet |
| `--surface` | Cards / panels | White / translucent white |
| `--line` / `--line-strong` | Borders | Soft violet-gray lines |
| Brand violet | Accents, links, numbers | `#7c3aed` / `#6d28d9` / `#6d4dff` |
| Brand pink | Gradient partner | `#e879c0` / soft blush |
| Page wash | Atmosphere | `#f8f5fa` → `#f1ecf6` lilac mist |

### 3.2 Gradients

| Name | Use |
|------|-----|
| Title gradient | Headlines emphasis (violet → pink) |
| CTA gradient | Primary buttons (`btn-grad`) violet → pink |
| Atmosphere | Soft radial washes behind sections — not flat white |

### 3.3 Rules

- Prefer soft lilac atmosphere over flat gray SaaS blue  
- Avoid generic “AI purple glow” overload; use violet as accent, not full-page neon  
- Text contrast: body on wash must remain readable (WCAG AA target)  
- Status colors: success green, warn amber, error rose — spare use only  

---

## 4. Typography

| Role | Family | Notes |
|------|--------|-------|
| Display / headings | **Outfit** (`--font-display`) | Tight tracking (−0.03 to −0.04em), weight 700–800 |
| Body / UI | **Outfit** (`--font-body`) | Same family as headings — weights 400–500 only |
| Logo | **Outfit** | Matches site type system |
| Numbers / indexes | Outfit | Feature indices `01`–`06`, step numbers |

**Rule:** One typeface sitewide (Outfit). Hierarchy comes from size and weight, not mixing fonts.

### Type scale (guidance)

| Level | Size (desktop) | Weight | Use |
|-------|----------------|--------|-----|
| Hero H1 | clamp ~2.5–4.5rem | 700 | Brand + one headline |
| Section H2 | clamp ~2.1–2.8rem | 700 | Section titles |
| Card H3 | ~1.1–1.2rem | 700 | Feature / output titles |
| Body | ~1.0–1.05rem | 400–500 | Supporting sentences |
| Eyebrow | ~0.72rem | 700 | Uppercase, tracked labels |
| Caption / meta | ~0.78–0.84rem | 600 | Tags, chips |

**Rule:** On branded first viewport, **brand is hero-level** — headline must not overpower LUCE.

---

## 5. Headings & Titles — Content Patterns

| Surface | Pattern |
|---------|---------|
| Eyebrow | Short category: `What you get`, `Why LUCE`, `Who it’s for` |
| H2 | Benefit + gradient span: e.g. `One product. Complete campaign pack.` |
| Support | One sentence max under H2 |
| App screens | Verb-led: `Confirm your product`, `Review strategy`, `Download campaign` |

### Sample title set (product app)

- Create campaign  
- Add your product  
- We found your product  
- Research & strategy  
- Generate campaign  
- Your campaign results  
- Download package  

---

## 6. UI Components (design language)

| Element | Spec |
|---------|------|
| Primary CTA | Pill button, violet→pink gradient |
| Secondary | Dark or ghost pill |
| Cards | Soft radius ~20–24px; light border; gentle shadow — use for interactive / content packs |
| Tags | Small uppercase pills on media |
| Nav | Floating translucent pill bar |
| Forms | Large URL field + image attach; clear labels |
| Progress | Named stages (not technical model names) |

**Motion:** 2–3 intentional motions (reveal on scroll, soft hover lift, progress). Prefer presence over noise.

---

## 7. Imagery Direction

| Type | Direction |
|------|-----------|
| Product | Real packaging fidelity — same bottle across scenes |
| UGC | Authentic creator clips, true product in frame |
| Lifestyle | Soft beauty / studio / daylight — cream, blush, marble |
| Avoid | Distorted logos, random unrelated SKUs in one pack, stock “robot AI” clichés |

---

## 8. Layout Principles (landing)

1. First viewport = one composition (brand, one headline, one line, CTA, dominant visual)  
2. Full-bleed / atmospheric hero — not inset collage cards in hero  
3. One job per section  
4. Mobile: stack grids; keep CTAs thumb-reachable  

---

## 9. Voice & Tone

| Do | Don’t |
|----|-------|
| Clear, confident, short | Hype jargon (“revolutionary neural…”) |
| Product-first language | Fake testimonials in MVP docs |
| Honest MVP boundaries (manual publish) | Promise autopilot social posting |

---

## 10. Deliverables Checklist

- [x] Logo / wordmark guidance  
- [x] Colors & gradients  
- [x] Typography  
- [x] Heading / title patterns  
- [x] Component + imagery direction  

---

*End of Design Brief v1.0*
