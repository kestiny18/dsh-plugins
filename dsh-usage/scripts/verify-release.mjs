import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packagePath = new URL('../package.json', import.meta.url)
const changelogPath = new URL('../CHANGELOG.md', import.meta.url)
const readmePath = new URL('../README.md', import.meta.url)
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
const changelog = readFileSync(changelogPath, 'utf8')
const readme = readFileSync(readmePath, 'utf8')
const errors = []
const warnings = []
const packageDirectory = fileURLToPath(new URL('../', import.meta.url))
const repositoryRoot = resolve(packageDirectory, '..')
const expectedDirectory = relative(repositoryRoot, packageDirectory).replaceAll('\\', '/')

function normalizeRepository(value) {
  const url = typeof value === 'string' ? value : value?.url
  if (typeof url !== 'string') return undefined
  const normalized = url.trim().replace(/^git\+/, '').replace(/\.git$/, '')
  const ssh = /^git@github\.com:(.+)$/.exec(normalized)
  return (ssh?.[1] ?? normalized.replace(/^https?:\/\/github\.com\//, '')).toLowerCase()
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  errors.push(`package.json version is not valid SemVer: ${manifest.version}`)
}
if (manifest.private === true) errors.push('package.json must not be private')
if (manifest.publishConfig?.access !== 'public') errors.push('publishConfig.access must be public')
if (manifest.publishConfig?.provenance !== true) errors.push('publishConfig.provenance must be true')
if (!changelog.includes(`## [${manifest.version}]`)) errors.push(`CHANGELOG.md has no ${manifest.version} release entry`)
if (/[A-Za-z]:\\/.test(readme)) errors.push('README.md contains a machine-specific Windows path')

const repository = normalizeRepository(manifest.repository)
const repositoryDirectory = typeof manifest.repository === 'object' ? manifest.repository?.directory : undefined
const githubRepository = process.env.GITHUB_REPOSITORY?.toLowerCase()
if (githubRepository !== undefined && repository !== githubRepository) {
  errors.push(`package.json repository (${repository ?? 'missing'}) must match GitHub repository (${githubRepository})`)
} else if (repository === undefined) {
  warnings.push('package.json repository is not set; add the root origin and run pnpm repo:sync before publishing')
}
if (repository !== undefined && repositoryDirectory !== expectedDirectory) {
  errors.push(`package.json repository.directory must be ${expectedDirectory}, got ${repositoryDirectory ?? 'missing'}`)
}

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expectedTag = `${manifest.name}-v${manifest.version}`
  if (process.env.GITHUB_REF_NAME !== expectedTag) errors.push(`release tag must be ${expectedTag}, got ${process.env.GITHUB_REF_NAME}`)
}

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number)
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 18)) errors.push(`Node.js 22.18 or newer is required, got ${process.versions.node}`)

if (process.env.GITHUB_ACTIONS === 'true') {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const npmVersion = execFileSync(npm, ['--version'], { encoding: 'utf8' }).trim()
  const [npmMajor, npmMinor] = npmVersion.split('.').map(Number)
  if (npmMajor < 11 || (npmMajor === 11 && npmMinor < 5)) errors.push(`npm 11.5.1 or newer is required for Trusted Publishing, got ${npmVersion}`)
}

for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`)
if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`error: ${error}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Release metadata is valid for ${manifest.name}@${manifest.version}.\n`)
}
