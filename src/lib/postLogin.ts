const PATH_KEY = 'luce.postLoginPath'
const TRY_FREE_KEY = 'luce.tryFreeImages'
const URL_KEY = 'luce.pendingProductUrl'
const HINT_KEY = 'luce.pendingProductHint'

export type PostLoginPath =
  | '/app'
  | '/app/campaigns/new'
  | '/app/studio/photos'

const ALLOWED: PostLoginPath[] = [
  '/app',
  '/app/campaigns/new',
  '/app/studio/photos',
]

function isAllowed(value: string | null): value is PostLoginPath {
  return Boolean(value && ALLOWED.includes(value as PostLoginPath))
}

/** Store where to land after login (landing CTAs). */
export function setPostLoginPath(path: PostLoginPath) {
  try {
    sessionStorage.setItem(PATH_KEY, path)
  } catch {
    /* ignore */
  }
}

/**
 * Resolve destination once. Safe to call multiple times in the same session —
 * only clears the explicit path key after first successful read so React Strict Mode
 * cannot wipe Try free → Image Studio down to Dashboard.
 */
let consumedPath: PostLoginPath | null = null

export function resolvePostLoginPath(): PostLoginPath {
  if (consumedPath) return consumedPath

  try {
    const next = sessionStorage.getItem(PATH_KEY)
    if (isAllowed(next)) {
      sessionStorage.removeItem(PATH_KEY)
      consumedPath = next
      return next
    }

    if (
      sessionStorage.getItem(TRY_FREE_KEY) === '1' ||
      sessionStorage.getItem(URL_KEY) ||
      sessionStorage.getItem(HINT_KEY)
    ) {
      consumedPath = '/app/studio/photos'
      return consumedPath
    }
  } catch {
    /* ignore */
  }

  consumedPath = '/app'
  return consumedPath
}

/** Reset module cache (tests / logout). */
export function resetPostLoginCache() {
  consumedPath = null
}
