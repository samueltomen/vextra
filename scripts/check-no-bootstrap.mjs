import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const forbiddenDependencies = new Set([
  'bootstrap',
  'bootstrap-icons',
  'react-bootstrap',
])

async function findPackageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findPackageFiles(path)))
    } else if (entry.name === 'package.json') {
      files.push(path)
    }
  }

  return files
}

const packageFiles = await findPackageFiles(process.cwd())
const violations = []

for (const packageFile of packageFiles) {
  const packageJson = JSON.parse(await readFile(packageFile, 'utf8'))

  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const dependency of Object.keys(packageJson[section] ?? {})) {
      if (forbiddenDependencies.has(dependency)) {
        violations.push(`${packageFile}: ${dependency}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Bootstrap est interdit dans ce projet :')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exitCode = 1
} else {
  console.log('Aucune dépendance Bootstrap détectée.')
}
