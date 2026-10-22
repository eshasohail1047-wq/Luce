import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Minimal probe — no deps beyond the Vercel runtime. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    message: 'LUCE API alive',
    node: process.version,
    vercel: process.env.VERCEL ?? null,
  })
}
