/**
 * Phase 1.1 — optional Playwright pass to verify rendered fonts/colors.
 * Falls back gracefully when Chromium is unavailable (e.g. slim serverless).
 */

export type RenderedFontSample = {
  usage: 'heading' | 'body' | 'navigation' | 'button'
  fontFamily: string
  /** First named family from computed font-family (no generic fallbacks). */
  primaryFont: string
  selector: string
  property: 'font-family'
}

export type RenderedColorSample = {
  usage: 'background' | 'text' | 'heading' | 'button' | 'navigation' | 'accent'
  hex: string
  selector: string
  property: string
}

export type RenderedBrandEvidence = {
  fonts: RenderedFontSample[]
  colors: RenderedColorSample[]
  loadedFontFamilies: string[]
  warnings: string[]
  usedPlaywright: boolean
}

const RENDER_TIMEOUT_MS = 22_000
const NAV_TIMEOUT_MS = 18_000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Keep evaluate body as a string so tsx/esbuild cannot inject __name helpers into the browser. */
const PAGE_SNAPSHOT_SCRIPT = `(() => {
  const pick = (selectors) => {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 && rect.height < 2) continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        return el;
      } catch (e) {}
    }
    return null;
  };

  const classSuffix = (el) => {
    if (!el || typeof el.className !== 'string' || !el.className.trim()) return '';
    return '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
  };

  const readFont = (el) => {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return { fontFamily: style.fontFamily, tag: el.tagName.toLowerCase() };
  };

  const readColor = (el, props) => {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const out = { tag: el.tagName.toLowerCase() };
    for (const p of props) out[p] = style[p];
    return out;
  };

  const heading = pick([
    'main h1',
    'h1',
    '[class*="hero"] h1',
    '[class*="hero"] h2',
    'h2.section__title-text',
    'h2'
  ]);
  const body = pick([
    'main .rte p',
    'main p',
    'article p',
    '.rte p',
    '.product__description p',
    'p'
  ]);
  const nav = pick([
    'header nav a.primary-nav__link',
    'header nav a',
    'nav a',
    'header a',
    '[role="navigation"] a'
  ]);
  const productTitle = pick([
    '.product-card__title',
    '.product-title',
    '.card__heading a',
    '.product__title',
    'h3.product-card__title',
    '[class*="product"] h3',
    '[class*="product-card"] a'
  ]);
  // Prefer accent / brand CTAs over generic full-width utility buttons
  const button = pick([
    'a.c-btn--accent',
    'button.c-btn--accent',
    '.c-btn--accent',
    'a.button--primary',
    'button.button--primary',
    'main a.button:not([href^="#"]):not(.skip-to-content-link)',
    'main button.button',
    'a[class*="btn"]:not([href^="#"]):not(.skip-to-content-link)',
    '.btn:not([disabled]):not(.skip-to-content-link)',
    'button.c-btn:not([disabled])',
    'button[type="submit"]',
    'a[href*="/collections"]',
    'a[href*="/products"]',
    'button.button'
  ]);
  const pageRoot = pick(['body', 'html']);

  const faces = [];
  try {
    document.fonts.forEach((f) => { if (f && f.family) faces.push(f.family); });
  } catch (e) {}

  return {
    heading: readFont(heading),
    body: readFont(body),
    nav: readFont(nav),
    button: readFont(button),
    productTitle: readFont(productTitle),
    headingColor: readColor(heading, ['color', 'backgroundColor']),
    bodyColor: readColor(body, ['color', 'backgroundColor']),
    navColor: readColor(nav, ['color', 'backgroundColor']),
    buttonColor: readColor(button, ['color', 'backgroundColor']),
    productTitleColor: readColor(productTitle, ['color', 'backgroundColor']),
    pageColor: readColor(pageRoot, ['color', 'backgroundColor']),
    loadedFonts: Array.from(new Set(faces)),
    selectors: {
      heading: heading ? heading.tagName.toLowerCase() + classSuffix(heading) : '',
      body: body ? body.tagName.toLowerCase() + classSuffix(body) : '',
      nav: nav ? nav.tagName.toLowerCase() + classSuffix(nav) : '',
      button: button ? button.tagName.toLowerCase() + classSuffix(button) : '',
      productTitle: productTitle ? productTitle.tagName.toLowerCase() + classSuffix(productTitle) : '',
      page: 'body'
    }
  };
})()`

function firstNamedFont(fontFamily: string): string | null {
  const parts = fontFamily.split(',')
  for (const raw of parts) {
    let p = raw.trim().replace(/^["']|["']$/g, '')
    if (!p) continue
    if (
      /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|inherit|initial|unset)$/i.test(
        p,
      )
    ) {
      continue
    }
    if (/icon/i.test(p)) continue
    if (p.length < 2 || p.length > 48) continue
    return p
  }
  return null
}

function rgbToHex(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  if (!t || t === 'transparent' || t === 'rgba(0, 0, 0, 0)') return null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t)
  if (hex) {
    let h = hex[1]!
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length === 8) h = h.slice(0, 6)
    return `#${h.toUpperCase()}`
  }
  const m =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(t)
  if (!m) return null
  const a = m[4] === undefined ? 1 : Number(m[4])
  if (a < 0.15) return null
  const r = Math.round(Number(m[1]))
  const g = Math.round(Number(m[2]))
  const b = Math.round(Number(m[3]))
  if ([r, g, b].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Serialize Playwright launches — parallel Chromium on Windows is flaky. */
let renderChain: Promise<unknown> = Promise.resolve()

/**
 * Inspect computed styles on key brand surfaces.
 */
export async function inspectRenderedBrand(
  pageUrl: string,
  parentSignal?: AbortSignal,
): Promise<RenderedBrandEvidence> {
  const run = async (): Promise<RenderedBrandEvidence> => {
  const warnings: string[] = []
  if (parentSignal?.aborted) {
    return {
      fonts: [],
      colors: [],
      loadedFontFamilies: [],
      warnings: ['Rendered inspection skipped: aborted.'],
      usedPlaywright: false,
    }
  }

  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    return {
      fonts: [],
      colors: [],
      loadedFontFamilies: [],
      warnings: ['Rendered inspection unavailable: Playwright not installed.'],
      usedPlaywright: false,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  parentSignal?.addEventListener('abort', onAbort)

  let browser: import('playwright').Browser | null = null
  try {
    // Prefer an installed browser channel so CI/local machines don't need a 200MB download.
    const launchAttempts: Array<Parameters<typeof playwright.chromium.launch>[0]> = [
      { headless: true, channel: 'chrome', args: ['--disable-dev-shm-usage'] },
      { headless: true, channel: 'msedge', args: ['--disable-dev-shm-usage'] },
      { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] },
    ]
    let lastLaunchError: unknown
    for (const opts of launchAttempts) {
      try {
        browser = await playwright.chromium.launch(opts)
        break
      } catch (err) {
        lastLaunchError = err
      }
    }
    if (!browser) {
      throw lastLaunchError instanceof Error
        ? lastLaunchError
        : new Error('Could not launch Chrome/Edge/Chromium for rendered inspection')
    }
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: true,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(NAV_TIMEOUT_MS)

    try {
      await page.goto(pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      })
    } catch {
      // Some Shopify stores stall before domcontentloaded; commit is enough for CSSOM samples.
      await page.goto(pageUrl, {
        waitUntil: 'commit',
        timeout: NAV_TIMEOUT_MS,
      })
    }
    // Allow late CSS / webfonts without waiting forever
    await new Promise((r) => setTimeout(r, 1200))

    type Snapshot = {
      heading: { fontFamily: string; tag: string } | null
      body: { fontFamily: string; tag: string } | null
      nav: { fontFamily: string; tag: string } | null
      button: { fontFamily: string; tag: string } | null
      productTitle: { fontFamily: string; tag: string } | null
      headingColor: Record<string, string> | null
      bodyColor: Record<string, string> | null
      navColor: Record<string, string> | null
      buttonColor: Record<string, string> | null
      productTitleColor: Record<string, string> | null
      pageColor: Record<string, string> | null
      loadedFonts: string[]
      selectors: {
        heading: string
        body: string
        nav: string
        button: string
        productTitle: string
        page: string
      }
    }
    const snapshot = (await page.evaluate(PAGE_SNAPSHOT_SCRIPT)) as Snapshot

    await context.close()

    const fonts: RenderedFontSample[] = []
    const pushFont = (
      usage: RenderedFontSample['usage'],
      sample: { fontFamily: string } | null,
      selector: string,
    ) => {
      if (!sample?.fontFamily) return
      const primary = firstNamedFont(sample.fontFamily)
      if (!primary) return
      fonts.push({
        usage,
        fontFamily: sample.fontFamily,
        primaryFont: primary,
        selector: selector || usage,
        property: 'font-family',
      })
    }
    pushFont('heading', snapshot.heading, snapshot.selectors.heading)
    pushFont('body', snapshot.body, snapshot.selectors.body)
    pushFont('navigation', snapshot.nav, snapshot.selectors.nav)
    pushFont('button', snapshot.button, snapshot.selectors.button)
    // Product titles count as heading evidence when present
    if (snapshot.productTitle?.fontFamily) {
      pushFont('heading', snapshot.productTitle, snapshot.selectors.productTitle)
    }

    const colors: RenderedColorSample[] = []
    const pushColor = (
      usage: RenderedColorSample['usage'],
      sample: Record<string, string> | null,
      selector: string,
      prefer: Array<'backgroundColor' | 'color'>,
    ) => {
      if (!sample) return
      for (const prop of prefer) {
        const hex = rgbToHex(sample[prop] || '')
        if (!hex) continue
        colors.push({
          usage,
          hex,
          selector: selector || usage,
          property: prop === 'backgroundColor' ? 'background-color' : 'color',
        })
      }
    }
    pushColor('background', snapshot.pageColor, 'body', ['backgroundColor'])
    pushColor('text', snapshot.bodyColor, snapshot.selectors.body || 'p', ['color'])
    pushColor('heading', snapshot.headingColor, snapshot.selectors.heading || 'h1', [
      'color',
    ])
    if (snapshot.productTitleColor) {
      pushColor(
        'heading',
        snapshot.productTitleColor,
        snapshot.selectors.productTitle || 'product-title',
        ['color'],
      )
    }
    pushColor('navigation', snapshot.navColor, snapshot.selectors.nav || 'nav a', [
      'color',
    ])
    pushColor('button', snapshot.buttonColor, snapshot.selectors.button || 'button', [
      'backgroundColor',
      'color',
    ])
    // Accent heuristic: button fill when distinct from page background / white
    if (snapshot.buttonColor?.backgroundColor) {
      const btn = rgbToHex(snapshot.buttonColor.backgroundColor)
      const page = snapshot.pageColor?.backgroundColor
        ? rgbToHex(snapshot.pageColor.backgroundColor)
        : null
      if (
        btn &&
        btn !== '#FFFFFF' &&
        btn !== '#000000' &&
        (!page || btn !== page)
      ) {
        colors.push({
          usage: 'accent',
          hex: btn,
          selector: snapshot.selectors.button || 'button',
          property: 'background-color',
        })
      }
    }

    const loadedFontFamilies = (snapshot.loadedFonts || [])
      .map((f) => firstNamedFont(f) || f)
      .filter((f, i, arr) => f && arr.findIndex((x) => x.toLowerCase() === f.toLowerCase()) === i)

    return {
      fonts,
      colors,
      loadedFontFamilies,
      warnings,
      usedPlaywright: true,
    }
  } catch (err) {
    warnings.push(
      `Rendered inspection failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
    return {
      fonts: [],
      colors: [],
      loadedFontFamilies: [],
      warnings,
      usedPlaywright: false,
    }
  } finally {
    clearTimeout(timer)
    parentSignal?.removeEventListener('abort', onAbort)
    try {
      await browser?.close()
    } catch {
      /* ignore */
    }
  }
  }

  const next = renderChain.then(run, run)
  renderChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

export function fontsRoughlyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  const nb = b.toLowerCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  if (!na || !nb) return false
  if (na === nb) return true
  // "Visby CF" vs "Visby"
  if (na.startsWith(nb) || nb.startsWith(na)) return true
  const ta = na.split(' ')[0]!
  const tb = nb.split(' ')[0]!
  return ta.length > 3 && ta === tb
}
