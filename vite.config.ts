import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'

function loadLocalEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = value
      }
    }
  } catch {
    /* ignore */
  }
}

async function readJsonBody(req: Connect.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

function localApiRoutes(): Plugin {
  return {
    name: 'luce-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]

        if (url === '/api/reset-password') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            const body = await readJsonBody(req)
            const { sendPasswordResetForEmail } = await import(
              './api/_lib/passwordReset.ts'
            )
            const result = await sendPasswordResetForEmail(String(body.email ?? ''))
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          } catch (err) {
            console.error('[vite] reset-password failed', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Reset email failed on server' }))
          }
          return
        }

        if (url === '/api/early-access') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            const body = await readJsonBody(req)
            const { sendEarlyAccessEmail } = await import('./api/_lib/earlyAccess.ts')
            const result = await sendEarlyAccessEmail({
              email: String(body.email ?? ''),
              productUrl: String(body.productUrl ?? ''),
              source: String(body.source ?? 'landing'),
            })
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          } catch (err) {
            console.error('[vite] early-access failed', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Could not send email. Try again.' }))
          }
          return
        }

        if (url === '/api/transactional') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            const body = await readJsonBody(req)
            const { verifyBearerToken } = await import('./api/_lib/firebaseAdmin.ts')
            const { sendTransactionalEmail } = await import(
              './api/_lib/transactional.ts'
            )
            const decoded = await verifyBearerToken(req.headers.authorization)
            if (!decoded?.email) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Sign in required to send account emails.',
                }),
              )
              return
            }
            const type = String(body.type ?? '')
            const allowed = [
              'welcome',
              'plan_upgraded',
              'pack_ready',
              'pack_exported',
            ]
            if (!allowed.includes(type)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unknown email type' }))
              return
            }
            const result = await sendTransactionalEmail({
              type: type as
                | 'welcome'
                | 'plan_upgraded'
                | 'pack_ready'
                | 'pack_exported',
              email: decoded.email,
              name: String(body.name ?? decoded.name ?? ''),
              planName: String(body.planName ?? ''),
              productName: String(body.productName ?? ''),
              campaignUrl: String(body.campaignUrl ?? ''),
            })
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          } catch (err) {
            console.error('[vite] transactional failed', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Could not send email. Try again.' }))
          }
          return
        }

        if (url === '/api/generate-videos') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            const body = await readJsonBody(req)
            const { verifyBearerToken } = await import('./api/_lib/firebaseAdmin.ts')
            const {
              generateCampaignVideos,
              VIDEO_ASSET_KINDS,
            } = await import('./api/_lib/generateVideos.ts')
            const decoded = await verifyBearerToken(req.headers.authorization)
            if (!decoded?.uid) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Sign in required to generate videos.',
                }),
              )
              return
            }
            const assetsRaw = Array.isArray(body.assets) ? body.assets : []
            const assets = assetsRaw
              .map((a) => String(a))
              .filter((a): a is (typeof VIDEO_ASSET_KINDS)[number] =>
                (VIDEO_ASSET_KINDS as string[]).includes(a),
              )
            const cd =
              body.creativeDirection && typeof body.creativeDirection === 'object'
                ? (body.creativeDirection as Record<string, unknown>)
                : undefined
            const result = await generateCampaignVideos({
              productName: String(body.productName ?? ''),
              productImage:
                typeof body.productImage === 'string'
                  ? body.productImage
                  : undefined,
              referenceFrameImage:
                typeof body.referenceFrameImage === 'string'
                  ? body.referenceFrameImage
                  : typeof body.referenceImage === 'string'
                    ? body.referenceImage
                    : undefined,
              creativeDirection: cd
                ? {
                    prompt: typeof cd.prompt === 'string' ? cd.prompt : undefined,
                    lighting:
                      typeof cd.lighting === 'string' ? cd.lighting : undefined,
                    background:
                      typeof cd.background === 'string'
                        ? cd.background
                        : undefined,
                    mood: typeof cd.mood === 'string' ? cd.mood : undefined,
                    styleTheme:
                      typeof cd.styleTheme === 'string'
                        ? cd.styleTheme
                        : undefined,
                  }
                : undefined,
              assets,
              recreateNote:
                typeof body.recreateNote === 'string'
                  ? body.recreateNote
                  : undefined,
            })
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          } catch (err) {
            console.error('[vite] generate-videos failed', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Video generation failed on server. Try again.',
              }),
            )
          }
          return
        }

        if (url === '/api/generate-images') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            const body = await readJsonBody(req)
            const { verifyBearerToken } = await import('./api/_lib/firebaseAdmin.ts')
            const {
              generateCampaignImages,
              IMAGE_ASSET_KINDS,
            } = await import('./api/_lib/generateImages.ts')
            const decoded = await verifyBearerToken(req.headers.authorization)
            if (!decoded?.uid) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Sign in required to generate images.',
                }),
              )
              return
            }
            const assetsRaw = Array.isArray(body.assets) ? body.assets : []
            const assets = assetsRaw
              .map((a) => String(a))
              .filter((a): a is (typeof IMAGE_ASSET_KINDS)[number] =>
                (IMAGE_ASSET_KINDS as string[]).includes(a),
              )
            const cd =
              body.creativeDirection && typeof body.creativeDirection === 'object'
                ? (body.creativeDirection as Record<string, unknown>)
                : undefined
            const result = await generateCampaignImages({
              productName: String(body.productName ?? ''),
              productImage:
                typeof body.productImage === 'string'
                  ? body.productImage
                  : undefined,
              referenceImage:
                typeof body.referenceImage === 'string'
                  ? body.referenceImage
                  : undefined,
              creativeDirection: cd
                ? {
                    prompt: typeof cd.prompt === 'string' ? cd.prompt : undefined,
                    lighting:
                      typeof cd.lighting === 'string' ? cd.lighting : undefined,
                    background:
                      typeof cd.background === 'string'
                        ? cd.background
                        : undefined,
                    mood: typeof cd.mood === 'string' ? cd.mood : undefined,
                    styleTheme:
                      typeof cd.styleTheme === 'string'
                        ? cd.styleTheme
                        : undefined,
                  }
                : undefined,
              assets,
              recreateNote:
                typeof body.recreateNote === 'string'
                  ? body.recreateNote
                  : undefined,
            })
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          } catch (err) {
            console.error('[vite] generate-images failed', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Image generation failed on server. Try again.',
              }),
            )
          }
          return
        }

        return next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  loadLocalEnv(mode)

  return {
    plugins: [react(), localApiRoutes()],
    server: {
      host: '127.0.0.1',
      port: 5176,
      strictPort: true,
    },
  }
})
