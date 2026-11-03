/** Remove per-campaign data cached in this browser so the next account on a shared device can't see it. */
export function clearLocalWorkspaceCache() {
  for (const store of [
    typeof localStorage !== 'undefined' ? localStorage : undefined,
    typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
  ]) {
    if (!store) continue
    try {
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)
        if (k && k.startsWith('luce.')) keys.push(k)
      }
      for (const k of keys) store.removeItem(k)
    } catch {
      /* storage unavailable */
    }
  }
}
