import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const git = process.platform === 'win32' ? 'git.exe' : 'git'

function fail(message) {
  process.stderr.write(`error: ${message}\n`)
  process.exit(1)
}

function githubSlug(remote) {
  const value = remote.trim().replace(/\.git$/, '')
  const match = /^(?:git@github\.com:|https?:\/\/github\.com\/)([^/]+\/[^/]+)$/.exec(value)
  return match?.[1]
}

let remote
try {
  remote = execFileSync(git, ['remote', 'get-url', 'origin'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
} catch {
  fail('No origin remote found. Add the GitHub monorepo as origin, then run this command again.')
}

const slug = githubSlug(remote)
if (slug === undefined) fail(`origin is not a supported GitHub URL: ${remote.trim()}`)

const packageDirectories = readdirSync(rootDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^dsh-/.test(entry.name))
  .map((entry) => entry.name)
  .filter((directory) => existsSync(join(rootDir, directory, 'package.json')))
  .sort()

if (packageDirectories.length === 0) fail('No direct dsh-* package directories were found.')

for (const directory of packageDirectories) {
  const packagePath = join(rootDir, directory, 'package.json')
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
  manifest.repository = {
    type: 'git',
    url: `git+https://github.com/${slug}.git`,
    directory,
  }
  manifest.homepage = `https://github.com/${slug}/tree/main/${directory}#readme`
  manifest.bugs = { url: `https://github.com/${slug}/issues` }
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`Synchronized ${manifest.name} (${directory}).\n`)
}

process.stdout.write(`Repository metadata now points to https://github.com/${slug}\n`)
