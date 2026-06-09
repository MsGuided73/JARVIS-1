// Targeted case ingest: pull ALL FrankReport posts for specific investigations
// (by category and/or title term), then MERGE them into data/raw/posts.json
// (deduped by id) so the existing vault slice is preserved and only extended.
//
// Usage:  node scripts/ingest-cases.mjs            (ingest every group below)
//         node scripts/ingest-cases.mjs sandusky   (one or more group keys)

import fs from 'node:fs/promises'
import path from 'node:path'

const API = 'https://frankreport.com/api/posts'
const OUT = path.resolve('data/raw/posts.json')
const PER_PAGE = 100
const DELAY_MS = 600
const SITE = process.env.FR_SITE || 'frankreport'
const UA = { 'User-Agent': 'frank-report-vault/0.1 (personal archive)' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Each group is a set of queries; a post matches the case if ANY query returns it.
// `category` is the high-confidence FrankReport category id; `title` is a substring.
const GROUPS = {
  sandusky: {
    label: 'Jerry Sandusky / Penn State',
    queries: [
      { category: 8 }, // the dedicated "Sandusky" category
      { title: 'sandusky' },
      { title: 'penn state' },
      { title: 'paterno' },
      { title: 'aaron fisher' },
      { title: 'second mile' },
    ],
  },
  hernandez: {
    label: 'Juan Orlando Hernandez (Honduras framing)',
    // No dedicated category — the series lives under generic ones, so match by title.
    queries: [
      { title: 'hernandez' },
      { title: 'juan orlando' },
      { title: 'honduran president' },
    ],
  },
}

function buildUrl(query, page) {
  const params = new URLSearchParams({
    limit: String(PER_PAGE),
    page: String(page),
    depth: '1', // populate categories/tags/authors/relatedPosts (matches ingest.mjs)
    sort: '-publishedAt',
    'where[_status][equals]': 'published',
  })
  if (SITE !== 'all') params.set('where[site][equals]', SITE)
  if (query.category != null) params.set('where[categories][in]', String(query.category))
  if (query.title) params.set('where[title][like]', query.title)
  return `${API}?${params.toString()}`
}

// Resilient GET — FrankReport's Next.js front occasionally returns a 500 HTML page.
async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: UA })
      const text = await res.text()
      if (text.startsWith('<')) throw new Error(`HTML (likely ${res.status})`)
      return JSON.parse(text)
    } catch (e) {
      if (attempt === 4) throw new Error(`failed after 4 tries: ${e.message}`)
      await sleep(800 * attempt)
    }
  }
}

async function fetchAllForQuery(query) {
  const out = []
  let page = 1
  let totalPages = Infinity
  while (page <= totalPages) {
    const data = await fetchJson(buildUrl(query, page))
    totalPages = data.totalPages ?? 1
    out.push(...(data.docs ?? []))
    if (!data.hasNextPage) break
    page += 1
    await sleep(DELAY_MS)
  }
  return out
}

async function main() {
  const keys = process.argv.slice(2).filter((k) => GROUPS[k])
  const selected = keys.length ? keys : Object.keys(GROUPS)
  console.log(`Ingesting case groups: ${selected.join(', ')}`)

  // De-dupe fetched posts by id across all queries/groups.
  const fetched = new Map()
  for (const key of selected) {
    const group = GROUPS[key]
    let groupCount = 0
    for (const query of group.queries) {
      const label = query.category != null ? `category ${query.category}` : `title~"${query.title}"`
      process.stdout.write(`  [${key}] ${label}... `)
      const docs = await fetchAllForQuery(query)
      let added = 0
      for (const d of docs) {
        if (d.id == null) continue
        if (!fetched.has(d.id)) added++
        fetched.set(d.id, d)
      }
      groupCount += added
      console.log(`${docs.length} returned, ${added} new`)
      await sleep(DELAY_MS)
    }
    console.log(`  [${key}] ${group.label}: ${groupCount} unique posts`)
  }

  // Merge into existing cache (preserve the POC slice), dedupe by id.
  let existing = []
  try {
    existing = JSON.parse(await fs.readFile(OUT, 'utf-8'))
  } catch {
    console.log('No existing posts.json — starting fresh.')
  }
  const merged = new Map()
  for (const p of existing) if (p.id != null) merged.set(p.id, p)
  let newToVault = 0
  for (const [id, p] of fetched) {
    if (!merged.has(id)) newToVault++
    merged.set(id, p) // fetched copy wins (depth=1, freshest)
  }

  const all = [...merged.values()].sort((a, b) =>
    String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')),
  )
  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(all, null, 2), 'utf-8')

  console.log(
    `\nFetched ${fetched.size} case posts (${newToVault} not previously in cache).`,
  )
  console.log(`posts.json now holds ${all.length} posts -> ${OUT}`)
}

main().catch((e) => {
  console.error('Case ingest failed:', e.message)
  process.exit(1)
})
