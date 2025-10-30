import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'

const ENV_PATH = '.env'
const KEY_NAME = 'JWT_SECRET'

// generate 32 bytes (256-bit) secret, base64url-encoded
function newSecret() {
  return randomBytes(32).toString('base64url')
}

function parseEnv(text) {
  return text.split('\n').map((line) => {
    // keep comments/blank lines verbatim
    if (/^\s*(#|$)/.test(line)) return { type: 'raw', value: line }
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) return { type: 'raw', value: line }
    return { type: 'kv', key: m[1], value: m[2] }
  })
}

function stringifyEnv(nodes) {
  return nodes
    .map((n) => (n.type === 'kv' ? `${n.key}=${n.value}` : n.value))
    .join('\n')
    .replace(/\n+$/,'') + '\n'
}

const rotate = process.argv.includes('--rotate')
let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
let nodes = parseEnv(content)

const idx = nodes.findIndex((n) => n.type === 'kv' && n.key === KEY_NAME)

if (idx === -1) {
  // Add new key
  nodes.push({ type: 'kv', key: KEY_NAME, value: newSecret() })
  writeFileSync(ENV_PATH, stringifyEnv(nodes), 'utf8')
  console.log(`Added ${KEY_NAME} to ${ENV_PATH}`)
  process.exit(0)
}

if (!rotate) {
  console.error(`${KEY_NAME} already exists. Use --rotate to replace it.`)
  process.exit(1)
}

// Backup and rotate
const backup = `.env.bak.${Date.now()}`
renameSync(ENV_PATH, backup)
nodes[idx].value = newSecret()
writeFileSync(ENV_PATH, stringifyEnv(nodes), 'utf8')
console.log(`Rotated ${KEY_NAME}. Backup at ${backup}`)
