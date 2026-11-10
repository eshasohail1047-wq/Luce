import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq <= 0) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  if (process.env[k] === undefined) process.env[k] = v
}

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
try {
  const { generateChatCompletion } = await server.ssrLoadModule(
    '/api/_lib/openRouter.ts',
  )
  const models = [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.0-flash-001',
    'google/gemini-2.5-flash',
  ]
  for (const model of models) {
    try {
      const r = await generateChatCompletion({
        system: 'Return only JSON {"ok":true,"brand":"test"}',
        user: 'Reply with the required JSON only.',
        model,
        temperature: 0.1,
        maxTokens: 40,
      })
      console.log('OK', model, '→', r.model, r.text.slice(0, 80))
    } catch (err) {
      console.log('FAIL', model, '→', err instanceof Error ? err.message : err)
    }
  }
} finally {
  await server.close()
}
