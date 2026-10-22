import fs from 'node:fs'
import path from 'node:path'

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name.endsWith('.ts')) fix(p)
  }
}

function fix(file) {
  const src = fs.readFileSync(file, 'utf8')
  const next = src.replace(
    /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
    (m, a, spec, c) => {
      if (/\.(js|json|node|mjs|cjs)$/.test(spec)) return m
      return `${a}${spec}.js${c}`
    },
  )
  if (next !== src) {
    fs.writeFileSync(file, next)
    console.log('fixed', file)
  }
}

walk('api')
