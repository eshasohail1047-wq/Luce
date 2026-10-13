"""Create 7 simple LUCE PDFs that are easy to read and download."""
from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

# Embedded DejaVu via fpdf2 core - use built-in Helvetica with ASCII-safe text
# Replace fancy punctuation for Helvetica compatibility


def clean(s: str) -> str:
    return (
        s.replace("—", "-")
        .replace("–", "-")
        .replace("→", "->")
        .replace("•", "-")
        .replace("☐", "[ ]")
        .replace("☑", "[x]")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("‘", "'")
        .replace("≥", ">=")
        .replace("×", "x")
        .replace("·", "-")
    )


class SimplePDF(FPDF):
    def __init__(self, title: str):
        super().__init__()
        self.doc_title = title
        self.set_auto_page_break(auto=True, margin=18)

    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(109, 40, 217)
        self.cell(0, 6, "LUCE - Bring Your Product to Light.", ln=1)
        self.set_draw_color(109, 40, 217)
        self.set_line_width(0.4)
        self.line(10, 14, 200, 14)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}  |  {self.doc_title}", align="C")

    def h1(self, text: str):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(76, 29, 149)
        self.multi_cell(0, 8, clean(text))
        self.ln(2)

    def h2(self, text: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(91, 33, 182)
        self.multi_cell(0, 7, clean(text))
        self.ln(1)

    def body(self, text: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6, clean(text))
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        self.set_x(14)
        self.multi_cell(0, 6, clean(f"- {text}"))

    def note(self, text: str):
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(80, 80, 80)
        self.multi_cell(0, 5.5, clean(text))
        self.ln(1)


DOCS: list[tuple[str, list[tuple[str, str | list[str]]]]] = [
    (
        "01-PRD-Simple.pdf",
        [
            ("h1", "1. PRD - What is LUCE?"),
            (
                "body",
                "PRD means Product Requirements Document. It explains what we are building and why.",
            ),
            ("h2", "Simple idea"),
            (
                "body",
                "LUCE turns ONE real product into a full marketing campaign. Flow: Product -> Research -> Strategy -> Complete campaign.",
            ),
            ("h2", "Who is it for?"),
            (
                "bullets",
                [
                    "Shopify / online shop brands",
                    "DTC (direct-to-customer) brands",
                    "Beauty, skincare, perfume, accessories, lifestyle products",
                ],
            ),
            ("h2", "What the user does"),
            (
                "bullets",
                [
                    "1. Create campaign",
                    "2. Add product URL or product photos",
                    "3. Confirm product details",
                    "4. LUCE researches market and competitors",
                    "5. LUCE builds strategy",
                    "6. LUCE generates visuals, videos, social posts, ads",
                    "7. User reviews, edits, downloads ZIP",
                    "8. User posts manually (no auto-publish in MVP)",
                ],
            ),
            ("h2", "What you get"),
            (
                "bullets",
                [
                    "Product photos and lifestyle images",
                    "UGC / Reels style videos",
                    "Captions, hooks, CTAs, hashtags",
                    "Ad creatives and ad copy",
                    "Research + campaign strategy",
                    "Saved campaigns + ZIP download",
                ],
            ),
            ("h2", "Big problems we solve"),
            (
                "bullets",
                [
                    "Brands use too many separate AI tools",
                    "AI often changes the real product look (distortion)",
                    "Assets look random and not like one campaign",
                ],
            ),
            ("h2", "MVP vs later"),
            (
                "body",
                "MVP = create, research, strategy, generate, save, download. Later = auto post to Instagram/TikTok, scheduling, analytics.",
            ),
            ("note", "One line: LUCE turns one real product into a research-backed marketing campaign."),
        ],
    ),
    (
        "02-TRD-Simple.pdf",
        [
            ("h1", "2. TRD - How we build it"),
            (
                "body",
                "TRD means Technical Requirements Document. It lists tools and technical rules.",
            ),
            ("h2", "Tech stack (simple)"),
            (
                "bullets",
                [
                    "Frontend: Next.js (website + app screens)",
                    "Backend: Node.js (APIs and jobs)",
                    "Database: Firebase Firestore",
                    "Login: Firebase Auth + Google/Gmail",
                    "Files: Firebase Storage (images, videos, ZIP)",
                    "Email: Resend",
                    "Hosting: Vercel",
                    "Code: Git / GitHub",
                    "Domain: DNS A-record points to Vercel",
                ],
            ),
            ("h2", "Logging (for marks)"),
            (
                "body",
                "Every important action writes a clear log: time, module name, user/campaign id, success or fail. Modules: auth, transcribe, clipping, plans.",
            ),
            ("h2", "Errors"),
            (
                "bullets",
                [
                    "Show simple messages to the user",
                    "Allow retry when possible",
                    "Do not show scary technical stack traces",
                    "Bad URL -> offer manual upload",
                    "Plan limit -> show upgrade option",
                ],
            ),
            ("h2", "Unit testing"),
            (
                "body",
                "We write small tests for login helpers, plan limits, product field cleaning, and error codes. Tests run before deploy. Logging + errors + tests = quality section (about 7 marks).",
            ),
            ("h2", "Hosting and domain"),
            (
                "body",
                "App runs on Vercel. Custom domain uses DNS A-record / CNAME as Vercel shows. Emails go through Resend.",
            ),
        ],
    ),
    (
        "03-App-Flow-Simple.pdf",
        [
            ("h1", "3. App Flow - User journey"),
            (
                "body",
                "This document shows how users move through the app (routes and steps).",
            ),
            ("h2", "Marketing website pages (current landing)"),
            (
                "bullets",
                [
                    "Home / Hero",
                    "How it works",
                    "What you get",
                    "Why LUCE",
                    "Who it is for",
                    "Pricing",
                    "FAQ",
                    "Login / Create campaign buttons",
                ],
            ),
            ("h2", "Main app routes (Next.js)"),
            (
                "bullets",
                [
                    "/login - Google/Gmail login",
                    "/dashboard - saved campaigns",
                    "/campaigns/new - start",
                    "/campaigns/[id]/confirm - check product",
                    "/campaigns/[id]/research - research",
                    "/campaigns/[id]/strategy - strategy",
                    "/campaigns/[id]/generate - generate",
                    "/campaigns/[id]/results - review",
                    "/campaigns/[id]/download - ZIP",
                    "/billing - plans",
                ],
            ),
            ("h2", "Happy path (easy flow)"),
            (
                "body",
                "Login -> Dashboard -> New campaign -> Add product -> Confirm -> Research -> Strategy -> Generate -> Review -> Download ZIP -> Post manually.",
            ),
            ("h2", "Modules in the flow"),
            (
                "bullets",
                [
                    "Auth: Google login",
                    "Transcribe: read product URL/images into data",
                    "Clipping: make short UGC/video clips",
                    "Plans: Free vs Paid limits",
                ],
            ),
        ],
    ),
    (
        "04-Design-Brief-Simple.pdf",
        [
            ("h1", "4. Design Brief - Brand look"),
            (
                "body",
                "This is the brand kit: logo, colors, fonts, and title style.",
            ),
            ("h2", "Brand"),
            (
                "bullets",
                [
                    "Name: LUCE (means Light in Italian)",
                    "Tagline: Bring Your Product to Light.",
                    "Feel: clean, premium, calm, beauty/DTC style",
                ],
            ),
            ("h2", "Logo"),
            (
                "body",
                "Simple LUCE wordmark. Keep space around it. Do not stretch or add heavy glow.",
            ),
            ("h2", "Colors"),
            (
                "bullets",
                [
                    "Soft lilac / cream page background",
                    "Violet accent (#7c3aed / #6d28d9)",
                    "Pink accent for gradients",
                    "Dark text for reading",
                    "White soft cards",
                ],
            ),
            ("h2", "Typography"),
            (
                "bullets",
                [
                    "Headings: strong display font (Sora style)",
                    "Body: clean sans (Outfit style)",
                    "Short titles + one support sentence per section",
                ],
            ),
            ("h2", "Title style"),
            (
                "bullets",
                [
                    "Small eyebrow label (What you get, Why LUCE)",
                    "Big clear heading",
                    "One short support line",
                    "One main CTA button",
                ],
            ),
            ("h2", "Images"),
            (
                "body",
                "Always show the SAME real product. Change scene/light, not the bottle shape or logo.",
            ),
        ],
    ),
    (
        "05-Schema-Simple.pdf",
        [
            ("h1", "5. Schema - Data and storage"),
            (
                "body",
                "This document explains what we save in Firebase and who can access it.",
            ),
            ("h2", "Main data (simple)"),
            (
                "bullets",
                [
                    "users - account, plan (free/starter/pro)",
                    "products - product name, details, photos",
                    "campaigns - status and settings",
                    "research - market/competitor notes",
                    "strategy - audience, message, CTA",
                    "assets - images, videos, captions",
                    "usage - monthly limits count",
                ],
            ),
            ("h2", "File storage folders"),
            (
                "body",
                "users/{userId}/products/... for source photos. users/{userId}/campaigns/... for generated files and campaign.zip.",
            ),
            ("h2", "Access control (who can see what)"),
            (
                "bullets",
                [
                    "Only logged-in owner can read/write their data",
                    "Server writes usage and jobs",
                    "Downloads use temporary signed links",
                    "Plan limits checked on server before generate",
                ],
            ),
            ("h2", "Remember"),
            (
                "body",
                "Flow: User -> Product -> Campaign -> Research/Strategy -> Assets -> Dashboard -> Download.",
            ),
        ],
    ),
    (
        "06-Implementation-Plan-Simple.pdf",
        [
            ("h1", "6. Implementation Plan - Build phases"),
            (
                "body",
                "This is the step-by-step build plan for the team.",
            ),
            ("h2", "Phase 0 - Setup"),
            (
                "bullets",
                [
                    "Next.js project",
                    "Firebase + Vercel + GitHub",
                    "Basic logger and tests",
                ],
            ),
            ("h2", "Phase 1 - Auth (Gmail)"),
            (
                "bullets",
                [
                    "Google login",
                    "Create user record",
                    "Protect dashboard",
                    "Welcome email (Resend)",
                ],
            ),
            ("h2", "Phase 2 - Transcribe"),
            (
                "bullets",
                [
                    "Read product from URL or photos",
                    "Fill product fields",
                    "Confirm screen for user edits",
                ],
            ),
            ("h2", "Phase 3 - Clipping"),
            (
                "bullets",
                [
                    "Generate UGC / short videos",
                    "Save to Storage",
                    "Preview + regenerate",
                ],
            ),
            ("h2", "Phase 4 - Full campaign"),
            (
                "bullets",
                [
                    "Research + strategy",
                    "Images, social, ads",
                    "ZIP download + dashboard",
                ],
            ),
            ("h2", "Phase 5 - Plans / Paid"),
            (
                "bullets",
                [
                    "Free limits",
                    "Starter/Pro upgrade",
                    "Block generate when limit reached",
                ],
            ),
            ("h2", "Phase 6 - Finish"),
            (
                "body",
                "Fix errors, finish tests, connect custom domain (A-record), launch on Vercel.",
            ),
        ],
    ),
    (
        "07-Testing-Milestone-Simple.pdf",
        [
            ("h1", "7. Testing Milestone - How we prove it works"),
            (
                "body",
                "Testing proves Auth, Transcribe, Clipping, and Plans work. Also shows logging, errors, and unit tests (about 7 marks).",
            ),
            ("h2", "What we test"),
            (
                "bullets",
                [
                    "Unit tests = small code checks",
                    "Manual tests = click through the app",
                    "End-to-end = full campaign from login to ZIP",
                ],
            ),
            ("h2", "Must-pass checklist"),
            (
                "bullets",
                [
                    "[ ] Google login works",
                    "[ ] Add product URL or photos",
                    "[ ] Confirm product",
                    "[ ] Research and strategy appear",
                    "[ ] Videos/images generate (clipping)",
                    "[ ] Download ZIP works",
                    "[ ] Free plan limit blocks extra campaigns",
                    "[ ] Error messages are clear + retry works",
                    "[ ] Logs show module + request id",
                    "[ ] npm test passes",
                ],
            ),
            ("h2", "Demo for sir (quick)"),
            (
                "bullets",
                [
                    "1. Show a failed URL -> clear error + log",
                    "2. Show plan limit -> upgrade message",
                    "3. Run unit tests -> all green",
                    "4. Complete one full campaign download",
                ],
            ),
            ("h2", "Sign-off"),
            (
                "body",
                "Developer: __________  Date: __________\nSupervisor: __________  Date: __________\nResult: Pass / Pass with conditions / Fail",
            ),
        ],
    ),
]


def build(filename: str, sections: list[tuple[str, str | list[str]]]):
    title = filename.replace(".pdf", "").replace("-", " ")
    pdf = SimplePDF(title)
    pdf.add_page()
    for kind, content in sections:
        if kind == "h1":
            pdf.h1(str(content))
        elif kind == "h2":
            pdf.h2(str(content))
        elif kind == "body":
            pdf.body(str(content))
        elif kind == "note":
            pdf.note(str(content))
        elif kind == "bullets":
            assert isinstance(content, list)
            for item in content:
                pdf.bullet(item)
            pdf.ln(1)
    path = OUT / filename
    pdf.output(path)
    print("Wrote", path.name)


def main():
    for filename, sections in DOCS:
        build(filename, sections)
    print("Folder:", OUT)


if __name__ == "__main__":
    main()
