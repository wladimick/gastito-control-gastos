const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const root = process.cwd()
const partsDir = path.join(root, '.chatgpt-patch')
const parts = fs.readdirSync(partsDir)
  .filter(name => /^part-.*\.b64$/.test(name))
  .sort()

const encoded = parts.map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim()).join('')
const patch = Buffer.from(encoded, 'base64')
const expectedSize = 70628
const expectedSha = '5bced9ac8c2bd41c58d06bf90294791228bd97506aa7425125471ab173cae86e'
const actualSha = crypto.createHash('sha256').update(patch).digest('hex')

if (patch.length !== expectedSize) throw new Error(`Patch size mismatch: ${patch.length}`)
if (actualSha !== expectedSha) throw new Error(`Patch SHA mismatch: ${actualSha}`)

const patchPath = path.join('/tmp', 'gastito-facturacion.patch')
fs.writeFileSync(patchPath, patch)
execFileSync('git', ['apply', '--check', patchPath], { cwd: root, stdio: 'inherit' })
execFileSync('git', ['apply', patchPath], { cwd: root, stdio: 'inherit' })
execFileSync(path.join(root, 'node_modules', '.bin', 'vite'), ['build'], { cwd: root, stdio: 'inherit' })

const files = [
  'docs/2026-08-02-facturacion-agosto-2026.md',
  'docs/supabase.md',
  'src/App.jsx',
  'src/components/Billing.jsx',
  'src/services/billedStatementsService.js',
  'supabase/migrations/20260802160025_billing_cycles_supabase.sql',
  'supabase/migrations/20260802161837_billing_privilege_hardening.sql',
  'supabase/migrations/20260802170324_billing_foreign_key_indexes.sql',
]

const exported = {}
const manifest = {}
for (const file of files) {
  const bytes = fs.readFileSync(path.join(root, file))
  exported[file] = bytes.toString('base64')
  manifest[file] = {
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  }
}

fs.writeFileSync(path.join(root, 'dist', '__patched_sources.json'), JSON.stringify(exported))
fs.writeFileSync(path.join(root, 'dist', '__patched_manifest.json'), JSON.stringify({ patchSha256: actualSha, files: manifest }, null, 2))
