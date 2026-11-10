import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchProductPage } from './_lib/fetchProductPage.js'
import type { ScanProgressEvent } from './_lib/scanProgress.js'

export const config = {
  api: {
    // Allow longer brand scans (Playwright + CSS + AI)
    responseLimit: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const url = typeof body.url === 'string' ? body.url : ''
    const mode = body.mode === 'brand' ? 'brand' : 'product'
    const stream = body.stream === true && mode === 'brand'

    if (stream) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      // @ts-expect-error — Node flush when available
      if (typeof res.flushHeaders === 'function') res.flushHeaders()

      const write = (obj: unknown) => {
        res.write(`${JSON.stringify(obj)}\n`)
      }

      const result = await fetchProductPage(url, {
        mode: 'brand',
        onProgress: (event: ScanProgressEvent) => write(event),
      })

      if (!result.ok) {
        write({ type: 'error', error: result.error, status: result.status })
        res.end()
        return
      }
      write({ type: 'result', ok: true, ...result.data })
      res.end()
      return
    }

    const result = await fetchProductPage(url, { mode })
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }
    return res.status(200).json({ ok: true, ...result.data })
  } catch (err) {
    console.error('[fetch-product]', err)
    if (!res.headersSent) {
      return res.status(500).json({
        error:
          err instanceof Error && err.message
            ? err.message
            : 'Could not fetch product page.',
      })
    }
    try {
      res.write(
        `${JSON.stringify({
          type: 'error',
          error:
            err instanceof Error ? err.message : 'Could not fetch product page.',
        })}\n`,
      )
      res.end()
    } catch {
      /* ignore */
    }
  }
}
