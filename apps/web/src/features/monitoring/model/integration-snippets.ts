export type IntegrationSnippetId =
  | 'bash'
  | 'crontab'
  | 'curl'
  | 'github'
  | 'node'
  | 'powershell'
  | 'python'
  | 'run'
  | 'url'

export type IntegrationSnippet = Readonly<{
  code: string
  hint: string
  id: IntegrationSnippetId
  label: string
}>

type SnippetParams = Readonly<{
  intervalMinutes?: number | undefined
  pingUrl: string
  /** Token affiché une seule fois ; `null` référence la variable d'environnement. */
  token: string | null
}>

const TOKEN_PLACEHOLDER = 'votre-token'

export function toCronExpression(intervalMinutes: number | undefined): string {
  if (intervalMinutes === undefined) {
    return '*/5 * * * *'
  }

  if (intervalMinutes < 60 && 60 % intervalMinutes === 0) {
    return `*/${intervalMinutes} * * * *`
  }

  if (intervalMinutes % 60 === 0 && intervalMinutes < 1_440) {
    const hours = intervalMinutes / 60

    return hours === 1 ? '0 * * * *' : `0 */${hours} * * *`
  }

  if (intervalMinutes === 1_440) {
    return '0 3 * * *'
  }

  if (intervalMinutes === 10_080) {
    return '0 3 * * 1'
  }

  return '*/5 * * * *'
}

export function buildIntegrationSnippets({
  intervalMinutes,
  pingUrl,
  token,
}: SnippetParams): readonly IntegrationSnippet[] {
  const shellToken = token ?? '$CRONPING_TOKEN'
  const literalToken = token ?? TOKEN_PLACEHOLDER

  return [
    {
      code: `curl --fail --silent --show-error --retry 3 \\
  --request POST \\
  --header "Authorization: Bearer ${shellToken}" \\
  "${pingUrl}"`,
      hint: 'Une commande à placer à la fin de n’importe quel script.',
      id: 'curl',
      label: 'curl',
    },
    {
      code: `# Mesure la durée du job et signale un échec immédiatement
curl -fsS -m 10 -X POST -H "Authorization: Bearer ${shellToken}" "${pingUrl}/start"
if /chemin/vers/job.sh; then
  curl -fsS -m 10 --retry 3 -X POST -H "Authorization: Bearer ${shellToken}" "${pingUrl}"
else
  curl -fsS -m 10 --retry 3 -X POST -H "Authorization: Bearer ${shellToken}" "${pingUrl}/fail"
fi`,
      hint: 'start puis success donne la durée ; fail ouvre un incident tout de suite.',
      id: 'run',
      label: 'Durée et échec',
    },
    {
      code: `# Sans en-tête : le token est dans l'URL (GET, HEAD ou POST)
curl -fsS -m 10 --retry 3 "${pingUrl}/${shellToken}"

# Variante : le code de sortie du job décide (0 = succès, 1-255 = échec)
/chemin/vers/job.sh; curl -fsS -m 10 "${pingUrl}/${shellToken}/$?"`,
      hint: 'Pratique avec wget ou sans en-têtes ; l’URL contient le secret, évitez de la journaliser.',
      id: 'url',
      label: 'Par URL',
    },
    {
      code: `# crontab -e
CRONPING_TOKEN=${literalToken}
${toCronExpression(intervalMinutes)} /chemin/vers/job.sh && curl -fsS -m 10 --retry 3 -X POST -H "Authorization: Bearer $CRONPING_TOKEN" "${pingUrl}" > /dev/null`,
      hint: 'Le ping ne part que si le job se termine avec succès (&&).',
      id: 'crontab',
      label: 'crontab',
    },
    {
      code: `#!/usr/bin/env bash
set -euo pipefail

./mon-job.sh

curl --fail --silent --show-error --retry 3 --max-time 10 \\
  --request POST \\
  --header "Authorization: Bearer ${shellToken}" \\
  "${pingUrl}"`,
      hint: 'Avec set -e, aucun ping n’est envoyé si le job échoue.',
      id: 'bash',
      label: 'Bash',
    },
    {
      code: `import os
import urllib.request

request = urllib.request.Request(
    "${pingUrl}",
    method="POST",
    headers={"Authorization": "Bearer " + ${
      token === null ? 'os.environ["CRONPING_TOKEN"]' : `"${token}"`
    }},
)
urllib.request.urlopen(request, timeout=10)`,
      hint: 'Bibliothèque standard uniquement, aucune dépendance.',
      id: 'python',
      label: 'Python',
    },
    {
      code: `const response = await fetch("${pingUrl}", {
  method: "POST",
  headers: { Authorization: ${
    token === null
      ? '`Bearer ${process.env.CRONPING_TOKEN}`'
      : `"Bearer ${token}"`
  } },
  signal: AbortSignal.timeout(10_000),
})

if (!response.ok) {
  throw new Error(\`CronPing a répondu \${response.status}\`)
}`,
      hint: 'Node.js 18 ou plus récent, fetch natif.',
      id: 'node',
      label: 'Node.js',
    },
    {
      code: `Invoke-RestMethod -Method Post -Uri "${pingUrl}" \`
  -Headers @{ Authorization = "Bearer ${token ?? '$env:CRONPING_TOKEN'}" } \`
  -TimeoutSec 10`,
      hint: 'Pour les tâches planifiées Windows.',
      id: 'powershell',
      label: 'PowerShell',
    },
    {
      code: `- name: Ping CronPing
  if: success()
  run: >-
    curl --fail --silent --show-error --retry 3 --request POST
    --header "Authorization: Bearer \${{ secrets.CRONPING_TOKEN }}"
    "${pingUrl}"`,
      hint: 'Ajoutez le token dans les secrets du dépôt, jamais en clair.',
      id: 'github',
      label: 'GitHub Actions',
    },
  ]
}
