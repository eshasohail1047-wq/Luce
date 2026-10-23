import { useEffect, useMemo, useState } from 'react'
import type { CampaignDoc, ProductSummary } from '../lib/campaigns'
import { resolveCampaignCover } from '../lib/localDemoCampaign'

/** Resolve imagery for campaign list/grid cards (generated cover → product → stash). */
export function useCampaignCovers(
  campaigns: CampaignDoc[],
  productsById: Map<string, ProductSummary>,
): Map<string, string> {
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map())

  const fingerprint = useMemo(
    () =>
      campaigns
        .map((c) => {
          const product = c.productId ? productsById.get(c.productId) : undefined
          return `${c.id}:${product?.imageUrl ?? ''}:${c.status}`
        })
        .join('|'),
    [campaigns, productsById],
  )

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const next = new Map<string, string>()
      await Promise.all(
        campaigns.map(async (c) => {
          const product = c.productId ? productsById.get(c.productId) : undefined
          try {
            const url = await resolveCampaignCover(c.id, product?.imageUrl)
            if (url) next.set(c.id, url)
          } catch (err) {
            console.warn('[covers] resolve failed', c.id, err)
          }
        }),
      )
      if (!cancelled) setCovers(next)
    })()

    return () => {
      cancelled = true
    }
    // fingerprint captures campaign ids + product urls + status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint])

  return covers
}
