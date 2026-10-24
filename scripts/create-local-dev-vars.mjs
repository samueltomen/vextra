import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const target = join(root, 'apps', 'api', '.dev.vars')
const force = process.argv.includes('--force')

if (existsSync(target) && !force) {
  console.log(
    `apps/api/.dev.vars already exists. Use --force to regenerate it.`,
  )
  process.exit(0)
}

let statusOutput

try {
  statusOutput = execFileSync(
    join(root, 'node_modules', '.bin', 'supabase'),
    ['status', '-o', 'env'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
} catch {
  console.error(
    'Supabase local is not running. Run "pnpm exec supabase start", then retry "pnpm setup:local".',
  )
  process.exit(1)
}

const status = new Map(
  statusOutput
    .split('\n')
    .map((line) => /^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/u.exec(line.trim()))
    .filter(Boolean)
    .map((match) => [match[1], match[2] ?? match[3] ?? '']),
)

const supabaseUrl = status.get('API_URL')
const publishableKey = status.get('PUBLISHABLE_KEY') ?? status.get('ANON_KEY')
const serviceRoleKey = status.get('SERVICE_ROLE_KEY')

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error(
    'Supabase status did not expose API_URL, PUBLISHABLE_KEY and SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

const contents = [
  'APP_ORIGIN=http://localhost:5173',
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
  `SESSION_ENCRYPTION_KEY=${randomBytes(48).toString('base64url')}`,
  `PING_TOKEN_PEPPER=${randomBytes(48).toString('base64url')}`,
  '',
].join('\n')

await writeFile(target, contents, { encoding: 'utf8', mode: 0o600 })
await chmod(target, 0o600)
console.log('Created apps/api/.dev.vars (ignored by Git).')
console.log('Restart the API dev server if it was already running.')
