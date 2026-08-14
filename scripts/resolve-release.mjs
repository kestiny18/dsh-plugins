import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const releaseTag = process.env.RELEASE_TAG

function fail(message) {
  process.stderr.write(`error: ${message}\n`)
  process.exit(1)
}

if (!releaseTag) fail('RELEASE_TAG is required.')

const packages = readdirSync(rootDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^dsh-/.test(entry.name))
  .map((entry) => entry.name)
  .filter((directory) => existsSync(join(rootDir, directory, 'package.json')))
  .map((directory) => {
    const manifest = JSON.parse(readFileSync(join(rootDir, directory, 'package.json'), 'utf8'))
    return {
      directory,
      name: manifest.name,
      version: manifest.version,
      expectedTag: `${manifest.name}-v${manifest.version}`,
    }
  })

const selected = packages.find((item) => item.expectedTag === releaseTag)
if (!selected) {
  const expected = packages.map((item) => item.expectedTag).join(', ')
  fail(`release tag ${releaseTag} does not match a package version; expected one of: ${expected}`)
}

const isPrerelease = process.env.RELEASE_PRERELEASE === 'true' || selected.version.includes('-')
const output = {
  package_name: selected.name,
  directory: selected.directory,
  dist_tag: isPrerelease ? 'next' : 'latest',
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(output).map(([key, value]) => `${key}=${value}\n`).join(''),
  )
}

process.stdout.write(`${JSON.stringify({ releaseTag, ...output })}\n`)
