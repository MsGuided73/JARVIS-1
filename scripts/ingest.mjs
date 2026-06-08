// Ingest newest FrankReport.com articles from the Payload CMS REST API.
// Caches raw JSON to data/raw/ so we never re-fetch. POC default: 300 newest.

import fs from 'node:fs/promises'
import path from 'node:path'

const API = 'https://frankreport.com/api/posts'
const OUT_DIR = path.resolve('data/raw')
const PER_PAGE = 100
const TARGET = Number(process.env.FR_TARGET || 300) // POC slice; set FR_TARGET=all for full
const DELAY_MS = 600 // be polite to the server

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// FrankReport's Payload backend is multi-tenant (Frank Report + Artvoice + ...).
// Default to only posts published on frankreport.com. Set FR_SITE=all to include
// every tenant.
const SITE = process.env.FR_SITE || 'frankreport'

function buildUrl(page) {
  const params = new URLSearchParams({
    limit: String(PER_PAGE),
    page: String(page),
    depth: '1', // populate categories/tags/authors/relatedPosts one level deep
    sort: '-publishedAt', // newest first
    'where[_status][equals]': 'published',
  })
  if (SITE !== 'all') params.set('where[site][equals]', SITE)
  return `${API}?${params.toString()}`
}

async function fetchPage(page) {
  const url = buildUrl(page)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'frank-report-vault/0.1 (personal archive)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}: ${url}`)
  return res.json()
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const all = []
  let page = 1
  let totalPages = Infinity
  const unlimited = String(process.env.FR_TARGET || '').toLowerCase() === 'all'

  while (all.length < (unlimited ? Infinity : TARGET) && page <= totalPages) {
    process.stdout.write(`Fetching page ${page}... `)
    const data = await fetchPage(page)
    totalPages = data.totalPages ?? totalPages
    const docs = data.docs ?? []
    all.push(...docs)
    console.log(`got ${docs.length} (total so far ${all.length} / ${data.totalDocs})`)
    if (!data.hasNextPage) break
    page += 1
    await sleep(DELAY_MS)
  }

  const slice = unlimited ? all : all.slice(0, TARGET)
  const outFile = path.join(OUT_DIR, 'posts.json')
  await fs.writeFile(outFile, JSON.stringify(slice, null, 2), 'utf-8')
  console.log(`\nSaved ${slice.length} posts -> ${outFile}`)
}

main().catch((e) => {
  console.error('Ingest failed:', e.message)
  process.exit(1)
})
