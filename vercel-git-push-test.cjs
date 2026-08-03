const { execFileSync } = require('child_process')

function run(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const remoteMain = run(['ls-remote', '--heads', 'origin', 'main'])
if (!remoteMain.includes('refs/heads/main')) throw new Error('No se pudo leer main desde origin')
run(['push', '--dry-run', 'origin', 'HEAD:refs/heads/agent/vercel-push-test'])
console.log('VERCEL_GIT_PUSH_DRY_RUN_OK')
