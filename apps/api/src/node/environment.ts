export type SmtpConfig = Readonly<{
  host: string
  password: string | null
  port: number
  secure: boolean
  user: string | null
}>

export type NodeServerEnvironment = Readonly<{
  APP_ORIGIN: string
  EMAIL_FROM?: string
  PING_TOKEN_PEPPER: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  SESSION_ENCRYPTION_KEY: string
  SIGNUPS_ENABLED?: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_URL: string
}>

export type NodeConfig = Readonly<{
  clientIpHeader: string | null
  environment: NodeServerEnvironment
  port: number
  smtp: SmtpConfig | null
  webRoot: string
}>

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid configuration: ${problems.join('; ')}`)
    this.name = 'ConfigError'
  }
}

type Source = Readonly<Record<string, string | undefined>>

const MIN_SECRET_LENGTH = 32

function read(source: Source, name: string): string | undefined {
  const value = source[name]?.trim()

  return value ? value : undefined
}

/** Reads and validates the process environment of a self-hosted install. */
export function readNodeConfig(source: Source): NodeConfig {
  const problems: string[] = []

  function required(name: string): string {
    const value = read(source, name)

    if (!value) {
      problems.push(`${name} is required`)

      return ''
    }

    return value
  }

  function secret(name: string): string {
    const value = required(name)

    if (value && value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`)
    }

    return value
  }

  function url(name: string): string {
    const value = required(name)

    if (value) {
      try {
        new URL(value)
      } catch {
        problems.push(`${name} must be a valid URL`)
      }
    }

    return value
  }

  const appOrigin = url('APP_ORIGIN')
  const supabaseUrl = url('SUPABASE_URL')
  const publishableKey = required('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const sessionKey = secret('SESSION_ENCRYPTION_KEY')
  const pepper = secret('PING_TOKEN_PEPPER')

  const port = Number(read(source, 'PORT') ?? '8787')

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    problems.push('PORT must be an integer between 1 and 65535')
  }

  const provider = read(source, 'EMAIL_PROVIDER')

  if (provider !== undefined && provider !== 'resend' && provider !== 'smtp') {
    problems.push('EMAIL_PROVIDER must be "resend" or "smtp"')
  }

  const resendKey = read(source, 'RESEND_API_KEY')
  const resendFrom = read(source, 'RESEND_FROM_EMAIL')
  const smtpHost = read(source, 'SMTP_HOST')
  const emailFrom = read(source, 'EMAIL_FROM')
  const useSmtp =
    provider === 'smtp' || (provider === undefined && !resendKey && !!smtpHost)
  let smtp: SmtpConfig | null = null

  if (useSmtp) {
    const smtpPort = Number(read(source, 'SMTP_PORT') ?? '587')
    const user = read(source, 'SMTP_USER') ?? null
    const password = read(source, 'SMTP_PASSWORD') ?? null

    if (!smtpHost) {
      problems.push('SMTP_HOST is required when EMAIL_PROVIDER is "smtp"')
    }

    if (!emailFrom) {
      problems.push('EMAIL_FROM is required to send e-mail through SMTP')
    }

    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
      problems.push('SMTP_PORT must be an integer between 1 and 65535')
    }

    if ((user === null) !== (password === null)) {
      problems.push('SMTP_USER and SMTP_PASSWORD must be set together')
    }

    smtp = {
      host: smtpHost ?? '',
      password,
      port: smtpPort,
      secure: read(source, 'SMTP_SECURE') === 'true' || smtpPort === 465,
      user,
    }
  } else if (resendKey && !resendFrom) {
    problems.push('RESEND_FROM_EMAIL is required when RESEND_API_KEY is set')
  }

  if (problems.length > 0) {
    throw new ConfigError(problems)
  }

  const signups = read(source, 'SIGNUPS_ENABLED')

  return {
    clientIpHeader: read(source, 'CLIENT_IP_HEADER')?.toLowerCase() ?? null,
    environment: {
      APP_ORIGIN: appOrigin,
      PING_TOKEN_PEPPER: pepper,
      SESSION_ENCRYPTION_KEY: sessionKey,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_URL: supabaseUrl,
      ...(smtp && emailFrom ? { EMAIL_FROM: emailFrom } : {}),
      ...(!useSmtp && resendKey ? { RESEND_API_KEY: resendKey } : {}),
      ...(!useSmtp && resendFrom ? { RESEND_FROM_EMAIL: resendFrom } : {}),
      ...(signups !== undefined ? { SIGNUPS_ENABLED: signups } : {}),
    },
    port,
    smtp,
    webRoot: read(source, 'WEB_ROOT') ?? './web',
  }
}
