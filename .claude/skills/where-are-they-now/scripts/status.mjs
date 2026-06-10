#!/usr/bin/env node
// where-are-they-now :: status scanner (READ-ONLY)
//
// Scans a Frank Report-style Obsidian vault and reports which People notes
// already have a "Where Are They Now" research note, which are stale, and which
// still need one. Recommends the next N subjects to research.
//
// Usage:
//   node status.mjs [--vault <path>] [--next 5] [--stale-days 120] [--json]
//
// Vault resolution order:
//   1. --vault <path>
//   2. $JARVIS_VAULT_PATH
//   3. ./vault           (if cwd holds a People/ folder)
//   4. ~/.jarvis-config.json -> vaultPath

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const args = process.argv.slice(2)
function flag(name, def) {
  const i = args.indexOf(name)
  if (i === -1) return def
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const NEXT = Number(flag('--next', 5)) || 5
const STALE_DAYS = Number(flag('--stale-days', 120)) || 120
const JSON_ONLY = args.includes('--json')

function resolveVault() {
  const explicit = flag('--vault', null)
  if (explicit && explicit !== true) return path.resolve(explicit)
  if (process.env.JARVIS_VAULT_PATH) return process.env.JARVIS_VAULT_PATH
  if (fs.existsSync(path.resolve('vault', 'People'))) return path.resolve('vault')
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(os.homedir(), '.jarvis-config.json'), 'utf8'),
    )
    if (cfg.vaultPath) return cfg.vaultPath
  } catch {
    /* ignore */
  }
  return null
}

const VAULT = resolveVault()
if (!VAULT || !fs.existsSync(VAULT)) {
  console.error(
    'ERROR: could not resolve vault path. Pass --vault <path> or set JARVIS_VAULT_PATH.',
  )
  process.exit(1)
}

const PEOPLE_DIR = path.join(VAULT, 'People')
const RESEARCH_DIR = path.join(VAULT, 'Research', 'People')

// Minimal YAML frontmatter reader — scalars only (no deps).
function frontmatter(file) {
  let txt
  try {
    txt = fs.readFileSync(file, 'utf8')
  } catch {
    return {}
  }
  if (!txt.startsWith('---')) return {}
  const end = txt.indexOf('\n---', 3)
  if (end === -1) return {}
  const out = {}
  for (const line of txt.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function listMd(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }
}

// --- People (subjects) ---
const people = []
for (const f of listMd(PEOPLE_DIR)) {
  const fm = frontmatter(path.join(PEOPLE_DIR, f))
  if ((fm.type || '').toLowerCase() !== 'person') continue
  people.push({
    name: fm.title || path.basename(f, '.md'),
    article_count: Number(fm.article_count || 0),
    last_mention: fm.last_mention || null,
  })
}

// --- Existing research notes ---
const research = new Map()
for (const f of listMd(RESEARCH_DIR)) {
  const fm = frontmatter(path.join(RESEARCH_DIR, f))
  const subject = fm.subject || fm.title || path.basename(f, '.md')
  research.set(subject.toLowerCase(), {
    researched: fm.researched || fm.generated || null,
    source_article_count:
      fm.source_article_count != null ? Number(fm.source_article_count) : null,
    source_last_mention: fm.source_last_mention || null,
  })
}

const now = new Date()
function daysSince(d) {
  if (!d) return Infinity
  const t = Date.parse(d)
  return Number.isNaN(t) ? Infinity : Math.floor((now - t) / 86400000)
}

function classify(p) {
  const r = research.get(p.name.toLowerCase())
  if (!r) return { status: 'never', reason: 'no research note' }
  const reasons = []
  if (r.source_article_count != null && p.article_count > r.source_article_count)
    reasons.push(`+${p.article_count - r.source_article_count} new articles`)
  if (r.source_last_mention && p.last_mention && p.last_mention > r.source_last_mention)
    reasons.push(`new mention ${p.last_mention}`)
  const age = daysSince(r.researched)
  if (age > STALE_DAYS) reasons.push(`${age}d old`)
  if (reasons.length)
    return { status: 'stale', reason: reasons.join('; '), researched: r.researched }
  return { status: 'fresh', reason: `researched ${r.researched}`, researched: r.researched }
}

for (const p of people) Object.assign(p, classify(p))
people.sort((a, b) => b.article_count - a.article_count)

const never = people.filter((p) => p.status === 'never')
const stale = people.filter((p) => p.status === 'stale')
const fresh = people.filter((p) => p.status === 'fresh')
const next = [...never, ...stale].slice(0, NEXT)

if (JSON_ONLY) {
  console.log(
    JSON.stringify(
      {
        vault: VAULT,
        totals: {
          people: people.length,
          fresh: fresh.length,
          stale: stale.length,
          never: never.length,
        },
        next: next.map((p) => ({
          name: p.name,
          article_count: p.article_count,
          last_mention: p.last_mention,
          status: p.status,
          reason: p.reason,
        })),
        stale: stale.map((p) => ({ name: p.name, reason: p.reason })),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

console.log(`Vault: ${VAULT}`)
console.log(`People (type:person): ${people.length}`)
console.log(`  fresh:  ${fresh.length}`)
console.log(`  stale:  ${stale.length}`)
console.log(`  never:  ${never.length}`)
console.log('')
console.log(`Next ${next.length} to research (by coverage, never-researched first):`)
next.forEach((p, i) => {
  console.log(
    `  ${i + 1}. ${p.name}  (${p.article_count} articles, last mention ${
      p.last_mention || 'n/a'
    })  [${p.status}${p.reason ? ': ' + p.reason : ''}]`,
  )
})
if (stale.length) {
  console.log('')
  console.log('Stale (need refresh):')
  stale.slice(0, 20).forEach((p) => console.log(`  - ${p.name}  [${p.reason}]`))
}
console.log('')
console.log('Tip: re-run with --json for machine-readable output.')
