const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const root = process.cwd()
const encodedPath = path.join(root, '.chatgpt-patch', 'facturacion.patch.gz.b64')
const patchPath = path.join(root, '.chatgpt-patch', 'facturacion.patch')
const expectedSize = 70628
const expectedSha = '5bced9ac8c2bd41c58d06bf90294791228bd97506aa7425125471ab173cae86e'

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

const encoded = fs.readFileSync(encodedPath, 'utf8').trim()
const compressed = Buffer.from(encoded, 'base64')
const patch = zlib.gunzipSync(compressed)
const actualSha = crypto.createHash('sha256').update(patch).digest('hex')

console.log(`PATCH bytes=${patch.length} sha256=${actualSha}`)
if (patch.length !== expectedSize) throw new Error(`Patch size mismatch: ${patch.length}`)
if (actualSha !== expectedSha) throw new Error(`Patch SHA mismatch: ${actualSha}`)

fs.writeFileSync(patchPath, patch)
execFileSync('git', ['apply', '--check', patchPath], { cwd: root, stdio: 'inherit' })
execFileSync('git', ['apply', patchPath], { cwd: root, stdio: 'inherit' })

const exportRoot = path.join(root, 'public', '__patched')
for (const relative of files) {
  const source = path.join(root, relative)
  const target = path.join(exportRoot, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  console.log(`EXPORTED ${relative}`)
}

console.log('PATCH_APPLIED_AND_EXPORTED')
