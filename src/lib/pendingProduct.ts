const URL_KEY = 'luce.pendingProductUrl'
const HINT_KEY = 'luce.pendingProductHint'
const TRY_FREE_KEY = 'luce.tryFreeImages'
const DB_NAME = 'luce-pending'
const STORE = 'product'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open pending storage'))
  })
}

async function idbSet(key: string, value: unknown) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save pending product'))
  })
  db.close()
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Could not read pending product'))
  })
  db.close()
  return value
}

async function idbDel(key: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear pending product'))
  })
  db.close()
}

export async function stashPendingProduct(input: {
  url?: string
  file?: File | null
  hint?: string
  tryFree?: boolean
}) {
  try {
    if (input.url?.trim()) {
      sessionStorage.setItem(URL_KEY, input.url.trim())
    } else {
      sessionStorage.removeItem(URL_KEY)
    }

    if (input.hint?.trim()) {
      sessionStorage.setItem(HINT_KEY, input.hint.trim())
    } else {
      sessionStorage.removeItem(HINT_KEY)
    }

    if (input.tryFree) {
      sessionStorage.setItem(TRY_FREE_KEY, '1')
    }

    if (input.file) {
      await idbSet('image', input.file)
    } else {
      await idbDel('image')
    }
  } catch (err) {
    console.error('[pendingProduct] stash failed', err)
  }
}

export async function consumePendingProduct(): Promise<{
  url: string
  hint: string
  file: File | null
  tryFree: boolean
}> {
  let url = ''
  let hint = ''
  let tryFree = false
  let file: File | null = null

  try {
    url = sessionStorage.getItem(URL_KEY)?.trim() || ''
    hint = sessionStorage.getItem(HINT_KEY)?.trim() || ''
    tryFree = sessionStorage.getItem(TRY_FREE_KEY) === '1'
    sessionStorage.removeItem(URL_KEY)
    sessionStorage.removeItem(HINT_KEY)
    sessionStorage.removeItem(TRY_FREE_KEY)
  } catch {
    /* ignore */
  }

  try {
    const stored = await idbGet<File>('image')
    if (stored instanceof File) file = stored
    await idbDel('image')
  } catch (err) {
    console.error('[pendingProduct] consume image failed', err)
  }

  return { url, hint, file, tryFree }
}

export function peekTryFreeFlag() {
  try {
    return sessionStorage.getItem(TRY_FREE_KEY) === '1'
  } catch {
    return false
  }
}
