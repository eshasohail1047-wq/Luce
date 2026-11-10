/** Real scanning stages — percentage maps to completed backend work, not a timer. */

export const SCAN_STAGES = [
  { id: 'connecting', label: 'Connecting to website', pct: 8 },
  { id: 'pages', label: 'Analyzing website pages', pct: 20 },
  { id: 'assets', label: 'Extracting logo and visual assets', pct: 34 },
  { id: 'colors', label: 'Detecting colors', pct: 48 },
  { id: 'typography', label: 'Identifying typography', pct: 60 },
  { id: 'products', label: 'Analyzing products', pct: 72 },
  { id: 'identity', label: 'Understanding brand identity', pct: 86 },
  { id: 'kit', label: 'Preparing brand kit', pct: 96 },
  { id: 'done', label: 'Brand kit ready', pct: 100 },
] as const

export type ScanStageId = (typeof SCAN_STAGES)[number]['id']

export type ScanStageStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped'

export type ScanProgressEvent = {
  type: 'progress'
  stageId: ScanStageId
  status: ScanStageStatus
  pct: number
  label: string
  message?: string
  stats?: {
    pages?: number
    products?: number
    images?: number
    colors?: number
    fonts?: number
    stylesheets?: number
  }
  preview?: {
    logoUrl?: string
    imageUrls?: string[]
    colors?: string[]
    businessName?: string
  }
}

export type ScanProgressFn = (event: ScanProgressEvent) => void

export function stagePct(id: ScanStageId): number {
  return SCAN_STAGES.find((s) => s.id === id)?.pct ?? 0
}

export function stageLabel(id: ScanStageId): string {
  return SCAN_STAGES.find((s) => s.id === id)?.label ?? id
}

export function emitStage(
  onProgress: ScanProgressFn | undefined,
  stageId: ScanStageId,
  status: ScanStageStatus,
  extras?: Partial<Omit<ScanProgressEvent, 'type' | 'stageId' | 'status' | 'pct' | 'label'>>,
) {
  if (!onProgress) return
  onProgress({
    type: 'progress',
    stageId,
    status,
    pct: stagePct(stageId),
    label: stageLabel(stageId),
    ...extras,
  })
}
