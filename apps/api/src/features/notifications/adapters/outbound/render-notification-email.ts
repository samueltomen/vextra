import type { NotificationKind } from '../../application/deliver-notifications.ts'

import type { WeeklyReport } from '../../application/send-weekly-reports.ts'

export type RenderedEmail = Readonly<{
  html: string
  subject: string
  text: string
}>

type Variant = Readonly<{
  accent: string
  accentDark: string
  badge: string
  body: string
  heading: string
  subject: string
}>

const VARIANTS: Readonly<Record<NotificationKind, Variant>> = {
  incident_opened: {
    accent: '#d6403a',
    accentDark: '#f87171',
    badge: 'Incident ouvert',
    body: 'Votre moniteur n’a pas reçu de heartbeat dans la fenêtre attendue. Vérifiez que la tâche planifiée s’exécute toujours.',
    heading: 'Heartbeat manquant',
    subject: 'Vextra · heartbeat manquant',
  },
  run_failed: {
    accent: '#d6403a',
    accentDark: '#f87171',
    badge: 'Exécution en échec',
    body: 'Votre job a signalé lui-même un échec. Consultez l’historique des exécutions du moniteur pour la durée et l’heure.',
    heading: 'Exécution en échec',
    subject: 'Vextra · exécution en échec',
  },
  incident_resolved: {
    accent: '#16a36a',
    accentDark: '#34d399',
    badge: 'Incident résolu',
    body: 'Votre moniteur a de nouveau reçu un heartbeat. Tout est rentré dans l’ordre.',
    heading: 'Heartbeat reçu',
    subject: 'Vextra · heartbeat reçu',
  },
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderNotificationEmail(
  input: Readonly<{
    appOrigin: string
    kind: NotificationKind
    monitorId: string
    monitorName?: string | null
  }>,
): RenderedEmail {
  const variant = VARIANTS[input.kind]
  const origin = input.appOrigin.replace(/\/+$/u, '')
  const monitorUrl = `${origin}/monitors/${input.monitorId}`
  const settingsUrl = `${origin}/settings`
  const safeMonitorUrl = escapeHtml(monitorUrl)
  const safeSettingsUrl = escapeHtml(settingsUrl)
  const safeMonitorId = escapeHtml(input.monitorId)
  const monitorName = input.monitorName?.trim() || null
  const safeMonitorName = monitorName ? escapeHtml(monitorName) : null

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(variant.subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .cp-canvas { background: #0b1211 !important; }
    .cp-card { background: #121b1a !important; border-left-color: #243431 !important; border-right-color: #243431 !important; border-bottom-color: #243431 !important; }
    .cp-link { color: #5eead4 !important; }
    .cp-text { color: #e8f0ee !important; }
    .cp-muted { color: #94a6a2 !important; }
    .cp-code { background: #0f2d2a !important; color: #5eead4 !important; }
    .cp-cta { background: #2dd4bf !important; color: #04211e !important; }
    .cp-accent { color: ${variant.accentDark} !important; }
  }
  @media (max-width: 480px) { .cp-pad { padding: 24px 20px !important; } }
</style>
</head>
<body class="cp-canvas" style="margin:0;padding:0;background:#f4f7f6;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="cp-canvas" style="background:#f4f7f6;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">
      <tr><td style="background:#0a1816;border-radius:16px 16px 0 0;padding:20px 28px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="width:32px;height:32px;border-radius:8px;background:#2dd4bf;color:#032421;text-align:center;font:700 18px/32px -apple-system,'Segoe UI',Roboto,sans-serif;">&#8767;</td>
          <td style="padding-left:12px;font:600 18px -apple-system,'Segoe UI',Roboto,sans-serif;color:#e8f1ef;">Vextra</td>
        </tr></table>
      </td></tr>
      <tr><td class="cp-card cp-pad" style="background:#ffffff;border:1px solid #d8e1de;border-top:4px solid ${variant.accent};border-radius:0 0 16px 16px;padding:32px 28px;">
        <p class="cp-accent" style="margin:0 0 8px;font:700 12px -apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${variant.accent};">${escapeHtml(variant.badge)}</p>
        <h1 class="cp-text" style="margin:0 0 12px;font:700 26px/1.25 -apple-system,'Segoe UI',Roboto,sans-serif;color:#10201e;">${escapeHtml(variant.heading)}</h1>
        ${safeMonitorName ? `<p class="cp-text" style="margin:0 0 16px;font:600 18px -apple-system,'Segoe UI',Roboto,sans-serif;color:#10201e;">${safeMonitorName}</p>` : ''}
        <p class="cp-muted" style="margin:0 0 24px;font:400 16px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;">${escapeHtml(variant.body)}</p>
        <p class="cp-muted" style="margin:0 0 6px;font:600 12px -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;">Identifiant du moniteur</p>
        <p class="cp-code" style="margin:0 0 28px;padding:10px 12px;border-radius:8px;background:#e1f3f1;color:#0f766e;font:500 13px ui-monospace,'SFMono-Regular',Menlo,monospace;word-break:break-all;">${safeMonitorId}</p>
        <a class="cp-cta" href="${safeMonitorUrl}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#0f766e;color:#ffffff;font:600 15px -apple-system,'Segoe UI',Roboto,sans-serif;text-decoration:none;">Ouvrir le moniteur</a>
      </td></tr>
      <tr><td style="padding:20px 8px 0;text-align:center;">
        <p class="cp-muted" style="margin:0;font:400 12px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;">Vous recevez cet e-mail car vous êtes propriétaire de ce moniteur Vextra.<br><a class="cp-link" href="${safeSettingsUrl}" style="color:#0f766e;">Gérer mes notifications</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    `Vextra · ${variant.heading}`,
    '',
    variant.body,
    '',
    ...(monitorName ? [`Nom : ${monitorName}`] : []),
    `Moniteur : ${input.monitorId}`,
    `Ouvrir : ${monitorUrl}`,
    '',
    `Gérer mes notifications : ${settingsUrl}`,
  ].join('\n')

  return { html, subject: variant.subject, text }
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR')

export function renderWeeklyReportEmail(
  input: Readonly<{ appOrigin: string; report: WeeklyReport }>,
): RenderedEmail {
  const { report } = input
  const origin = input.appOrigin.replace(/\/+$/u, '')
  const subject = 'Vextra · votre rapport de la semaine'
  const greeting = report.displayName?.trim()
    ? `Bonjour ${report.displayName.trim()},`
    : 'Bonjour,'
  const healthy = report.incidentsOpenNow === 0
  const accent = healthy ? '#16a36a' : '#d6403a'
  const stats: readonly (readonly [string, number])[] = [
    ['Moniteurs', report.monitorsTotal],
    ['Heartbeats reçus', report.pings7d],
    ['Échecs signalés', report.fails7d],
    ['Incidents ouverts', report.incidentsOpened],
    ['Incidents en cours', report.incidentsOpenNow],
  ]
  const problems = report.problemMonitors.map((monitor) => ({
    label: monitor.name?.trim() || `Moniteur ${monitor.id.slice(0, 8)}`,
    url: `${origin}/monitors/${monitor.id}`,
    incidents: monitor.incidents,
  }))

  const statRows = stats
    .map(
      ([label, value]) =>
        `<tr><td class="cp-muted" style="padding:8px 0;font:400 14px -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;border-bottom:1px solid #e3e6eb;">${escapeHtml(label)}</td><td class="cp-text" style="padding:8px 0;text-align:right;font:600 16px ui-monospace,'SFMono-Regular',Menlo,monospace;color:#10201e;border-bottom:1px solid #e3e6eb;">${escapeHtml(NUMBER_FORMAT.format(value))}</td></tr>`,
    )
    .join('')
  const problemRows = problems
    .map(
      (problem) =>
        `<li style="margin:0 0 6px;font:400 14px -apple-system,'Segoe UI',Roboto,sans-serif;"><a class="cp-link" href="${escapeHtml(problem.url)}" style="color:#0f766e;">${escapeHtml(problem.label)}</a> <span class="cp-muted" style="color:#55655f;">· ${problem.incidents} incident${problem.incidents > 1 ? 's' : ''}</span></li>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .cp-canvas { background: #0b0c0f !important; }
    .cp-card { background: #111318 !important; border-left-color: #23262e !important; border-right-color: #23262e !important; border-bottom-color: #23262e !important; }
    .cp-text { color: #e6e8ec !important; }
    .cp-muted { color: #8a909c !important; }
    .cp-link { color: #5eead4 !important; }
    .cp-cta { background: #2dd4bf !important; color: #04211e !important; }
  }
</style>
</head>
<body class="cp-canvas" style="margin:0;padding:0;background:#f6f7f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="cp-canvas" style="background:#f6f7f9;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">
      <tr><td style="background:#0a1816;border-radius:16px 16px 0 0;padding:20px 28px;font:600 18px -apple-system,'Segoe UI',Roboto,sans-serif;color:#e8f1ef;">Vextra · Rapport hebdomadaire</td></tr>
      <tr><td class="cp-card" style="background:#ffffff;border:1px solid #e3e6eb;border-top:4px solid ${accent};border-radius:0 0 16px 16px;padding:28px;">
        <p class="cp-text" style="margin:0 0 6px;font:600 16px -apple-system,'Segoe UI',Roboto,sans-serif;color:#10201e;">${escapeHtml(greeting)}</p>
        <p class="cp-muted" style="margin:0 0 20px;font:400 14px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;">${healthy ? 'Aucun incident en cours : vos jobs sont dans les temps.' : 'Un ou plusieurs incidents sont encore ouverts : pensez à les consulter.'} Voici le résumé des 7 derniers jours.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${statRows}</table>
        ${problems.length > 0 ? `<p class="cp-text" style="margin:22px 0 8px;font:600 14px -apple-system,'Segoe UI',Roboto,sans-serif;color:#10201e;">Moniteurs à surveiller</p><ul style="margin:0;padding-left:18px;">${problemRows}</ul>` : ''}
        <p style="margin:26px 0 0;"><a class="cp-cta" href="${escapeHtml(origin)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f766e;color:#ffffff;font:600 15px -apple-system,'Segoe UI',Roboto,sans-serif;text-decoration:none;">Ouvrir Vextra</a></p>
      </td></tr>
      <tr><td style="padding:18px 8px 0;text-align:center;"><p class="cp-muted" style="margin:0;font:400 12px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#55655f;">Rapport envoyé le lundi à 9 h UTC. <a class="cp-link" href="${escapeHtml(origin)}/settings" style="color:#0f766e;">Désactiver dans les réglages</a></p></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    greeting,
    '',
    'Résumé des 7 derniers jours :',
    ...stats.map(
      ([label, value]) => `- ${label} : ${NUMBER_FORMAT.format(value)}`,
    ),
    ...(problems.length > 0
      ? [
          '',
          'Moniteurs à surveiller :',
          ...problems.map(
            (problem) =>
              `- ${problem.label} (${problem.incidents} incident${problem.incidents > 1 ? 's' : ''}) ${problem.url}`,
          ),
        ]
      : []),
    '',
    `Ouvrir Vextra : ${origin}`,
    `Désactiver ce rapport : ${origin}/settings`,
  ].join('\n')

  return { html, subject, text }
}
