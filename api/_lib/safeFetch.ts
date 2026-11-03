/**
 * SSRF-safe HTTP(S) GET. Used for every server-side fetch of a user-supplied URL.
 *
 * - http/https only, standard ports only, no embedded credentials
 * - hostname is resolved by our own `lookup`, and every resolved address must be public,
 *   so the check and the connection use the same IP (no DNS-rebinding gap)
 * - redirects are followed manually and each hop is re-validated
 * - body is streamed and aborted past `maxBytes`
 */
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

const MAX_REDIRECTS = 4

export type SafeFetchResult = {
  status: number
  url: string
  contentType: string
  body: Buffer
}

export class SafeFetchError extends Error {
  code: 'blocked' | 'too_large' | 'timeout' | 'network' | 'status'
  status?: number
  constructor(
    message: string,
    code: 'blocked' | 'too_large' | 'timeout' | 'network' | 'status',
    status?: number,
  ) {
    super(message)
    this.code = code
    this.status = status
  }
}

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  const [a, b] = p as [number, number]
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  )
}

export function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) return !isPrivateIPv4(ip)
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
    if (mapped) return !isPrivateIPv4(mapped[1]!)
    if (lower === '::' || lower === '::1') return false
    if (/^f[cd]/.test(lower)) return false // unique local fc00::/7
    if (/^fe[89ab]/.test(lower)) return false // link-local fe80::/10
    if (lower.startsWith('ff')) return false // multicast
    if (lower.startsWith('::ffff:')) return false // other mapped forms
    return true
  }
  return false
}

function validateUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new SafeFetchError('Invalid URL', 'blocked')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SafeFetchError('Only http(s) URLs are allowed', 'blocked')
  }
  if (u.username || u.password) {
    throw new SafeFetchError('URLs with credentials are not allowed', 'blocked')
  }
  if (u.port && u.port !== '80' && u.port !== '443') {
    throw new SafeFetchError('Only standard ports are allowed', 'blocked')
  }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new SafeFetchError('That host is not allowed', 'blocked')
  }
  if (net.isIP(host) && !isPublicIp(host)) {
    throw new SafeFetchError('That host is not allowed', 'blocked')
  }
  return u
}

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4)
    const list = Array.isArray(addresses) ? addresses : []
    if (!list.length || list.some((a) => !isPublicIp(a.address))) {
      return callback(
        new SafeFetchError('That host is not allowed', 'blocked'),
        '',
        4,
      )
    }
    const first = list[0]!
    if (options.all) {
      return (callback as unknown as (
        e: null,
        a: dns.LookupAddress[],
      ) => void)(null, list)
    }
    callback(null, first.address, first.family)
  })
}

function requestOnce(
  url: URL,
  headers: Record<string, string>,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.request(
      url,
      { method: 'GET', headers, lookup: safeLookup, signal },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400) {
          res.resume()
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) })
        }
        const declared = Number(res.headers['content-length'] || 0)
        if (declared > maxBytes) {
          res.destroy()
          return reject(new SafeFetchError('Response too large', 'too_large'))
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > maxBytes) {
            res.destroy()
            reject(new SafeFetchError('Response too large', 'too_large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () =>
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }),
        )
        res.on('error', (e) => reject(e))
      },
    )
    req.on('error', (e) => reject(e))
    req.end()
  })
}

export async function safeFetch(
  rawUrl: string,
  opts: { maxBytes: number; timeoutMs: number; headers?: Record<string, string> },
): Promise<SafeFetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    let current = validateUrl(rawUrl.trim())
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await requestOnce(
        current,
        opts.headers ?? {},
        opts.maxBytes,
        controller.signal,
      )
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.location
        if (!loc) throw new SafeFetchError('Bad redirect', 'network')
        current = validateUrl(new URL(loc, current).toString())
        continue
      }
      if (r.status < 200 || r.status >= 300) {
        throw new SafeFetchError(
          `Upstream responded ${r.status}`,
          'status',
          r.status,
        )
      }
      return {
        status: r.status,
        url: current.toString(),
        contentType: String(r.headers['content-type'] || ''),
        body: r.body,
      }
    }
    throw new SafeFetchError('Too many redirects', 'network')
  } catch (err) {
    if (err instanceof SafeFetchError) throw err
    if (controller.signal.aborted) {
      throw new SafeFetchError('Timed out', 'timeout')
    }
    const nested = (err as { cause?: unknown })?.cause ?? err
    if (nested instanceof SafeFetchError) throw nested
    throw new SafeFetchError('Could not fetch URL', 'network')
  } finally {
    clearTimeout(timer)
  }
}
