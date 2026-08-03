const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const root = process.cwd()
const patchDir = path.join(root, '.chatgpt-patch')
const patchPath = path.join(patchDir, 'facturacion.patch')
const baseCommit = '91f7db45e49d7a563f2cdfa01119bd16a8c2b4f1'
const expectedSize = 70628
const expectedSha = '5bced9ac8c2bd41c58d06bf90294791228bd97506aa7425125471ab173cae86e'
const originalPackage = `{
  "name": "gastito",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.105.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "vite": "^5.4.10"
  }
}`
const parts = [
  ['part-00.b64', 5520, 'eb194c31d5b0ab52cd477b9afb2d722c3b85437e96e814cf033812cc0055bf63'],
  ['part-01.b64', 5520, '614e9dd0e17a70d559940eb56e76f364860eaf23e81e20f4dbd1e32ee6614a20'],
  ['part-02.b64', 5520, '103688f91771f4122b7215e7827e22ca3833bea194e96b96105d5f158c121a45'],
  ['part-03.b64', 5520, '57ec8258bfeb467056b18cbcd249ebb86e2a4a61954cbc4076ea1c62d2675d59'],
]

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

const encoded = parts.map(([name, expectedLength, expectedPartSha]) => {
  const value = fs.readFileSync(path.join(patchDir, name), 'utf8').trim()
  const actualPartSha = crypto.createHash('sha256').update(value).digest('hex')
  console.log(`PART ${name} length=${value.length} sha256=${actualPartSha}`)
  if (value.length !== expectedLength) throw new Error(`${name} length mismatch: ${value.length}`)
  if (actualPartSha !== expectedPartSha) throw new Error(`${name} SHA mismatch: ${actualPartSha}`)
  return value
}).join('')

const compressed = Buffer.from(encoded, 'base64')
const patch = zlib.gunzipSync(compressed)
const actualSha = crypto.createHash('sha256').update(patch).digest('hex')
console.log(`PATCH bytes=${patch.length} sha256=${actualSha}`)
if (patch.length !== expectedSize) throw new Error(`Patch size mismatch: ${patch.length}`)
if (actualSha !== expectedSha) throw new Error(`Patch SHA mismatch: ${actualSha}`)

fs.writeFileSync(patchPath, patch)
execFileSync('git', ['apply', '--check', patchPath], { cwd: root, stdio: 'inherit' })
execFileSync('git', ['apply', patchPath], { cwd: root, stdio: 'inherit' })

// Return build configuration to main and remove every reconstruction helper
// before creating the final Git tree.
fs.writeFileSync(path.join(root, 'package.json'), originalPackage)
fs.rmSync(patchDir, { recursive: true, force: true })
fs.rmSync(path.join(root, 'scripts', 'build-patched-export.cjs'), { force: true })
try { fs.rmdirSync(path.join(root, 'scripts')) } catch {}
execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'inherit' })

const desiredTree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim()
const staged = execFileSync('git', ['ls-files', '-s'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .map(line => {
    const match = line.match(/^(\d+) ([0-9a-f]{40}) \d+\t(.+)$/)
    if (!match) throw new Error(`Unexpected index entry: ${line}`)
    return { mode: match[1], type: 'blob', sha: match[2], path: match[3] }
  })

const exportRoot = path.join(root, 'public', '__patched')
fs.mkdirSync(exportRoot, { recursive: true })
fs.writeFileSync(path.join(exportRoot, 'tree.json'), JSON.stringify({ baseCommit, desiredTree, entries: staged }))

for (const relative of files) {
  const source = path.join(root, relative)
  const raw = fs.readFileSync(source)
  const targetB64 = path.join(exportRoot, `${relative}.b64`)
  fs.mkdirSync(path.dirname(targetB64), { recursive: true })
  fs.writeFileSync(targetB64, raw.toString('base64'))
  const gitBlob = crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`), raw])).digest('hex')
  console.log(`EXPORTED ${relative} bytes=${raw.length} gitBlob=${gitBlob}`)
}

console.log(`CLEAN_TREE ${desiredTree} entries=${staged.length}`)
console.log('PATCH_APPLIED_AND_EXPORTED')
