// Build the research-grade Obsidian vault from cached FrankReport posts.
// Articles are filed by content-type (reliability), entities become dossiers with
// co-occurrence ("most connected to"), and series + case files aggregate investigations.

import fs from 'node:fs/promises'
import path from 'node:path'
import { lexicalToMarkdown, lexicalToText } from './lexical-to-md.mjs'
import { extractEntities } from './entities.mjs'
import { consolidate } from './canonical.mjs'
import { classifyContentType, contentFolder } from './reliability.mjs'
import { detectSeries, CASES, articleInCase, caseMatchKind, caseKeywords, sentenceMatchesCase } from './cases.mjs'
import { extractDates, extractEvents } from './dates.mjs'

const RAW = path.resolve('data/raw/posts.json')
const VAULT = path.resolve('vault')

const TYPE_FOLDER = {
  People: 'People', Judges: 'Judges', Organizations: 'Organizations',
  Government: 'Government', Legal: 'Legal', Places: 'Places',
  Programs: 'Programs', Families: 'People',
}
const ENTITY_FOLDERS = [...new Set(Object.values(TYPE_FOLDER))]
const KIND = {
  People: 'person', Judges: 'judge', Organizations: 'organization',
  Government: 'government body', Legal: 'court / legal', Places: 'place',
  Programs: 'program', Families: 'family',
}
const CONTENT_FOLDERS = ['Reporting', 'Investigations', 'Documents', 'Opinion', 'Guest-Views', 'Satire']

// ── helpers ─────────────────────────────────────────────────────────────────
function sanitize(name) {
  return String(name || 'Untitled')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 110).replace(/[ .]+$/, '')
}
const yamlEscape = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
const yamlList = (arr) => `[${arr.map(yamlEscape).join(', ')}]`
const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '')
const yearOf = (iso) => (iso ? String(iso).slice(0, 4) : '')
const span = (a, b) => (a && b ? (yearOf(a) === yearOf(b) ? yearOf(a) : `${yearOf(a)}–${yearOf(b)}`) : '')

async function writeNote(dir, name, body) {
  await fs.writeFile(path.join(dir, `${name}.md`), body, 'utf-8')
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const posts = JSON.parse(await fs.readFile(RAW, 'utf-8'))
  console.log(`Loaded ${posts.length} posts`)

  // 1. Unique note name per slug.
  const slugToNote = new Map()
  const used = new Map()
  for (const p of posts) {
    let base = sanitize(p.title)
    if (used.has(base.toLowerCase())) base = `${base} (${p.slug.slice(0, 12)})`
    used.set(base.toLowerCase(), true)
    slugToNote.set(p.slug, base)
  }
  const resolveSlug = (slug) => slugToNote.get(slug) || null

  // 2. Convert + scan.
  const converted = posts.map((p) => {
    const { markdown } = lexicalToMarkdown(p.content, { resolveSlug })
    const text = lexicalToText(p.content)
    return { post: p, markdown, text }
  })

  // 3. Entities.
  const rawMap = extractEntities(converted.map((c) => ({ slug: c.post.slug, text: c.text })), { minDocFreq: 4 })
  const { entities, slugEntities } = consolidate(rawMap)
  console.log(`Entities: ${rawMap.size} raw -> ${entities.size} canonical`)

  // 4. Series detection.
  const series = detectSeries(posts) // Map<stem, [{slug,title,part}]>
  const slugSeries = new Map()
  for (const [stem, parts] of series) for (const p of parts) slugSeries.set(p.slug, stem)

  // 5. Per-article metadata + indexes.
  const catArticles = new Map()
  const authorArticles = new Map()
  const entityArticles = new Map()
  const meta = new Map() // slug -> { noteName, date, cats, authors, ents, type, dates }
  const cooc = new Map() // entity -> Map<entity, count>
  const firstLast = new Map() // entity -> { first, last }
  const bump = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v)

  for (const c of converted) {
    const p = c.post
    const noteName = slugToNote.get(p.slug)
    const cats = (p.categories || []).map((x) => (typeof x === 'object' ? x.title : x)).filter(Boolean)
    const authors = (p.populatedAuthors || p.authors || []).map((x) => (typeof x === 'object' ? x.name || x.title : x)).filter(Boolean)
    const ents = [...(slugEntities.get(p.slug) || [])]
    const { type } = classifyContentType(p, cats)
    const dates = extractDates(c.text)
    const events = extractEvents(c.text)
    meta.set(p.slug, { noteName, title: p.title, date: p.publishedAt, cats, authors, ents, type, dates, events })

    for (const cat of cats) { if (!catArticles.has(cat)) catArticles.set(cat, []); catArticles.get(cat).push(noteName) }
    for (const a of authors) { if (!authorArticles.has(a)) authorArticles.set(a, []); authorArticles.get(a).push(noteName) }
    for (const e of ents) {
      if (!entityArticles.has(e)) entityArticles.set(e, []); entityArticles.get(e).push(noteName)
      const fl = firstLast.get(e) || { first: p.publishedAt, last: p.publishedAt }
      if (p.publishedAt < fl.first) fl.first = p.publishedAt
      if (p.publishedAt > fl.last) fl.last = p.publishedAt
      firstLast.set(e, fl)
    }
    // co-occurrence (unordered pairs)
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        if (!cooc.has(ents[i])) cooc.set(ents[i], new Map())
        if (!cooc.has(ents[j])) cooc.set(ents[j], new Map())
        bump(cooc.get(ents[i]), ents[j]); bump(cooc.get(ents[j]), ents[i])
      }
    }
  }

  // 6. Dirs.
  for (const d of [...CONTENT_FOLDERS, 'Categories', 'Authors', 'Series', 'Cases', ...ENTITY_FOLDERS]) {
    await fs.mkdir(path.join(VAULT, d), { recursive: true })
  }

  // 7. Article notes (filed by content type).
  const typeCounts = {}
  for (const c of converted) {
    const p = c.post
    const m = meta.get(p.slug)
    const ents = m.ents
    const related = (p.relatedPosts || []).map((r) => (typeof r === 'object' ? slugToNote.get(r.slug) || sanitize(r.title) : null)).filter(Boolean)
    const tags = (p.tags || []).map((x) => (typeof x === 'object' ? x.title : x)).filter(Boolean)
    typeCounts[m.type] = (typeCounts[m.type] || 0) + 1
    const { reliability } = classifyContentType(p, m.cats)
    const seriesName = slugSeries.get(p.slug)

    const fm = ['---', `title: ${yamlEscape(p.title)}`]
    if (p.publishedAt) fm.push(`date: ${dateOnly(p.publishedAt)}`)
    fm.push(`content_type: ${m.type}`, `reliability: ${reliability}`)
    if (m.cats.length) fm.push(`categories: ${yamlList(m.cats)}`)
    if (tags.length) fm.push(`tags: ${yamlList(tags.map((t) => t.replace(/\s+/g, '-')))}`)
    if (m.authors.length) fm.push(`author: ${yamlEscape(m.authors.join(', '))}`)
    if (seriesName) fm.push(`series: ${yamlEscape(seriesName)}`)
    if (m.dates.years.length) fm.push(`event_years: [${m.dates.years.join(', ')}]`)
    fm.push(`source: https://frankreport.com/${p.slug}`, `slug: ${yamlEscape(p.slug)}`)
    if (p.wpId) fm.push(`wpId: ${p.wpId}`)
    fm.push('---')

    const sections = [fm.join('\n'), `# ${p.title}`, `*${m.type} · reliability: ${reliability}*`]
    if (p.excerpt) sections.push(`> ${String(p.excerpt).replace(/\n+/g, ' ').trim()}`)
    sections.push(c.markdown || '_(no body content)_')

    const links = []
    if (seriesName) links.push(`**Series:** [[${sanitize(seriesName)} — Series|${seriesName}]]`)
    if (m.cats.length) links.push(`**Categories:** ${m.cats.map((x) => `[[${x}]]`).join(' · ')}`)
    if (m.authors.length) links.push(`**Author:** ${m.authors.map((x) => `[[${x}]]`).join(' · ')}`)
    if (ents.length) links.push(`**Mentions:** ${ents.map((x) => `[[${x}]]`).join(' · ')}`)
    if (related.length) links.push(`**Related:** ${related.map((x) => `[[${x}]]`).join(' · ')}`)
    if (links.length) sections.push('---', ...links)

    await writeNote(path.join(VAULT, contentFolder(m.type)), m.noteName, sections.join('\n\n'))
  }
  console.log('Article content types:', typeCounts)

  // 8. Category + Author hubs.
  const writeHub = async (dir, name, kind, articles, extra = []) => {
    const list = [...new Set(articles)].sort()
    const body = ['---', `title: ${yamlEscape(name)}`, `type: ${kind}`, `article_count: ${list.length}`, '---',
      `# ${name}`, `*${kind} · ${list.length} article${list.length === 1 ? '' : 's'}*`, ...extra, '',
      ...list.map((a) => `- [[${a}]]`)].join('\n')
    await writeNote(path.join(VAULT, dir), sanitize(name), body)
  }
  for (const [cat, arts] of catArticles) await writeHub('Categories', cat, 'category', arts)
  for (const [auth, arts] of authorArticles) await writeHub('Authors', auth, 'author', arts)

  // 9. Entity DOSSIERS (aliases, role, first/last, cases, co-occurrence).
  const entityCases = new Map() // entity -> Set(caseName)
  for (const caseDef of CASES) {
    for (const [slug, m] of meta) {
      if (articleInCase(caseDef, m.cats, m.ents, m.title)) for (const e of m.ents) {
        if (!entityCases.has(e)) entityCases.set(e, new Set()); entityCases.get(e).add(caseDef.name)
      }
    }
  }
  const typeCount = {}
  for (const [name, info] of entities) {
    typeCount[info.type] = (typeCount[info.type] || 0) + 1
    const arts = [...new Set(entityArticles.get(name) || [])]
    const fl = firstLast.get(name) || {}
    const aliases = [...(info.aliases || [])].filter((a) => a !== name)
    const cases = [...(entityCases.get(name) || [])]
    const top = [...(cooc.get(name) || new Map())].sort((a, b) => b[1] - a[1]).slice(0, 8)
    const children = [...entities].filter(([, v]) => v.parent === name).map(([k]) => k)

    const fm = ['---', `title: ${yamlEscape(name)}`, `type: ${KIND[info.type] || 'entity'}`]
    if (aliases.length) fm.push(`aliases: ${yamlList(aliases)}`)
    fm.push(`article_count: ${arts.length}`)
    if (fl.first) fm.push(`first_mention: ${dateOnly(fl.first)}`, `last_mention: ${dateOnly(fl.last)}`)
    if (cases.length) fm.push(`cases: ${yamlList(cases)}`)
    fm.push('---')

    const body = [fm.join('\n'), `# ${name}`, `*${KIND[info.type] || 'entity'} · ${arts.length} mention${arts.length === 1 ? '' : 's'}${fl.first ? ` · ${span(fl.first, fl.last)}` : ''}*`]
    if (info.parent && entities.has(info.parent)) body.push(`**Part of:** [[${info.parent}]]`)
    if (children.length) body.push(`**Includes:** ${children.map((c) => `[[${c}]]`).join(' · ')}`)
    if (aliases.length) body.push(`**Also known as:** ${aliases.join(' · ')}`)
    if (cases.length) body.push(`**Cases:** ${cases.map((c) => `[[${c} — Case File|${c}]]`).join(' · ')}`)
    if (top.length) body.push(`**Most connected to:** ${top.map(([e, n]) => `[[${e}]] (${n})`).join(' · ')}`)
    body.push('', '## Articles', ...arts.sort().map((a) => `- [[${a}]]`))
    await writeNote(path.join(VAULT, TYPE_FOLDER[info.type] || 'Organizations'), sanitize(name), body.join('\n\n'))
  }
  console.log(`Wrote: ${catArticles.size} categories, ${authorArticles.size} authors, ${entities.size} entity dossiers`)
  console.log('Entity types:', typeCount)

  // 10. Series MOCs.
  for (const [stem, parts] of series) {
    const body = ['---', `title: ${yamlEscape(stem + ' — Series')}`, 'type: series', `parts: ${parts.length}`, '---',
      `# ${stem} — Series`, `*series · ${parts.length} parts (reading order)*`, '',
      ...parts.map((p, i) => `${i + 1}. [[${slugToNote.get(p.slug)}]]`)].join('\n')
    await writeNote(path.join(VAULT, 'Series'), sanitize(stem + ' — Series'), body)
  }
  console.log(`Wrote ${series.size} series MOCs`)

  // 11. Case files (parties + timeline of events + articles).
  const timelinesOut = {}
  // Per-note event index for the sidebar timeline, keyed by relative note path.
  const eventsByPath = {}
  const EVENTS_PER_NODE = 80
  for (const caseDef of CASES) {
    const matched = [...meta].filter(([, m]) => articleInCase(caseDef, m.cats, m.ents, m.title))
    if (!matched.length) continue
    const rows = matched.map(([, m]) => m).sort((a, b) => (a.date < b.date ? -1 : 1))
    const keywords = caseKeywords(caseDef)
    const partyCount = new Map()
    const rawEvents = []
    for (const [, m] of matched) {
      for (const e of m.ents) bump(partyCount, e)
      const kind = caseMatchKind(caseDef, m.cats, m.ents, m.title) // 'category' (strong) | 'entity' (weak)
      const pubDay = dateOnly(m.date)
      for (const ev of m.events) {
        // An article can't report an event dated after its own publication — drop those
        // (they are almost always "as of <today>" reporting references, not real events).
        if (pubDay && ev.iso.slice(0, 10) > pubDay) continue
        // Weak (entity-only) matches: keep a dated sentence only if it actually names a
        // case figure, so a passing mention in an unrelated article can't pollute the timeline.
        if (kind === 'entity' && !sentenceMatchesCase(ev.description.toLowerCase(), keywords)) continue
        rawEvents.push({ iso: ev.iso, display: ev.display, precision: ev.precision, description: ev.description, note: m.noteName })
      }
    }
    // Dedupe (same date + note + description head) and sort chronologically.
    const seen = new Set()
    const events = rawEvents
      .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
      .filter((e) => {
        // Collapse the same dated sentence even when several articles repeat it.
        const k = `${e.iso}|${e.description.slice(0, 70).toLowerCase().replace(/[^a-z0-9 ]/g, '')}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

    const parties = [...partyCount].sort((a, b) => b[1] - a[1]).slice(0, 18)
    const first = rows[0]?.date, last = rows[rows.length - 1]?.date

    const timelineLines = events.length
      ? events.map((e) => `- **${e.display}** — ${e.description} — [[${e.note}]]`)
      : ['_no explicit event dates extracted_']

    const body = ['---', `title: ${yamlEscape(caseDef.name + ' — Case File')}`, 'type: case',
      `article_count: ${rows.length}`, `event_count: ${events.length}`, '---',
      `# ${caseDef.name} — Case File`, `*case · ${rows.length} articles · ${events.length} dated events · ${span(first, last)}*`, '',
      '## Key parties', parties.map(([e, n]) => `[[${e}]] (${n})`).join(' · ') || '_none_', '',
      '## Timeline of events', ...timelineLines, '',
      '## Coverage (newest first)',
      ...rows.slice().reverse().map((m) => `- ${dateOnly(m.date)} · [[${m.noteName}]]`)].join('\n')
    await writeNote(path.join(VAULT, 'Cases'), sanitize(caseDef.name + ' — Case File'), body)

    timelinesOut[caseDef.name] = {
      name: caseDef.name,
      note: sanitize(caseDef.name + ' — Case File'),
      articleCount: rows.length,
      span: span(first, last),
      events: events.map((e) => ({ date: e.iso, display: e.display, precision: e.precision, description: e.description, note: e.note })),
    }
    // Same events power the sidebar timeline when a Case node is selected.
    eventsByPath[`Cases/${sanitize(caseDef.name + ' — Case File')}.md`] =
      events.slice(0, EVENTS_PER_NODE).map((e) => ({ date: e.iso, display: e.display, precision: e.precision, description: e.description, source: e.note }))
  }
  console.log(`Wrote ${CASES.length} case files`)

  // Machine-readable timeline for the Jarvis UI. Lives inside the vault so the
  // server can read it, but is a .json so the graph walker (md-only) ignores it.
  const cases = Object.values(timelinesOut)
  await fs.writeFile(path.join(VAULT, 'Cases', '_timeline.json'), JSON.stringify({ cases }, null, 2), 'utf-8')
  console.log(`Wrote _timeline.json — ${cases.length} cases, ${cases.reduce((n, c) => n + c.events.length, 0)} events`)

  // 11b. Per-note event index for the sidebar timeline (keyed by relative note path,
  // matching GraphNode.path). Article = its own dated events; entity = dated sentences
  // (across mentioning articles) that name the entity; case = the case timeline above.
  const dedupeSort = (evs) => {
    const seen = new Set()
    return evs
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .filter((e) => {
        const k = `${e.date}|${e.description.slice(0, 70).toLowerCase().replace(/[^a-z0-9 ]/g, '')}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, EVENTS_PER_NODE)
  }

  // Articles — every dated sentence in the article belongs to it.
  for (const [, m] of meta) {
    if (!m.events.length) continue
    const relPath = `${contentFolder(m.type)}/${m.noteName}.md`
    eventsByPath[relPath] = m.events.map((e) => ({ date: e.iso, display: e.display, precision: e.precision, description: e.description, source: m.noteName }))
  }

  // Entities — dated sentences (from any mentioning article) that name the entity.
  const entityKeywords = (name, info) => {
    const kw = new Set([name.toLowerCase()])
    for (const a of (info.aliases || [])) kw.add(String(a).toLowerCase())
    const surname = name.toLowerCase().split(/\s+/).pop()
    if (surname && surname.length >= 4) kw.add(surname)
    return [...kw]
  }
  for (const [name, info] of entities) {
    const kw = entityKeywords(name, info)
    const evs = []
    for (const [, m] of meta) {
      if (!m.ents.includes(name)) continue
      for (const ev of m.events) {
        if (!kw.some((k) => ev.description.toLowerCase().includes(k))) continue
        evs.push({ date: ev.iso, display: ev.display, precision: ev.precision, description: ev.description, source: m.noteName })
      }
    }
    if (!evs.length) continue
    const relPath = `${TYPE_FOLDER[info.type] || 'Organizations'}/${sanitize(name)}.md`
    eventsByPath[relPath] = dedupeSort(evs)
  }

  await fs.writeFile(path.join(VAULT, '_events.json'), JSON.stringify({ byPath: eventsByPath }, null, 2), 'utf-8')
  const nodeCount = Object.keys(eventsByPath).length
  const evTotal = Object.values(eventsByPath).reduce((n, e) => n + e.length, 0)
  console.log(`Wrote _events.json — ${nodeCount} nodes, ${evTotal} events`)

  // 12. Dashboard.
  const topCats = [...catArticles.entries()].sort((a, b) => b[1].length - a[1].length)
  const topEnts = [...entityArticles.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25)
  const dash = ['---', 'title: "Frank Report — Dashboard"', 'type: moc', '---',
    '# Frank Report — Dashboard',
    `*${posts.length} articles · ${entities.size} entities · ${series.size} series · ${CASES.length} cases*`, '',
    '## Cases', ...CASES.map((c) => `- [[${c.name} — Case File|${c.name}]]`), '',
    '## Content types (reliability)',
    ...Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n}`), '',
    '## Categories', ...topCats.map(([c, a]) => `- [[${c}]] (${a.length})`), '',
    '## Most-mentioned entities', ...topEnts.map(([e, a]) => `- [[${e}]] (${a.length})`)].join('\n')
  await writeNote(VAULT, 'Dashboard', dash)

  await writeObsidianConfig()
  console.log(`\nVault built at ${VAULT}`)
}

async function writeObsidianConfig() {
  const dir = path.join(VAULT, '.obsidian')
  await fs.mkdir(dir, { recursive: true })
  const files = {
    'app.json': { alwaysUpdateLinks: true, newLinkFormat: 'shortest', useMarkdownLinks: false, attachmentFolderPath: '' },
    'appearance.json': { theme: 'obsidian', accentColor: '#22d3ee' },
    'core-plugins.json': ['file-explorer', 'global-search', 'graph', 'backlink', 'outgoing-link', 'tag-pane', 'page-preview', 'note-composer', 'command-palette'],
    'community-plugins.json': [],
    'graph.json': {
      collapse: false, showTags: false, showAttachments: false, hideUnresolved: true,
      colorGroups: [
        { query: 'path:Satire', color: { a: 1, rgb: 16729156 } },
        { query: 'path:Documents', color: { a: 1, rgb: 16744448 } },
        { query: 'path:Cases OR path:Series', color: { a: 1, rgb: 16766720 } },
        { query: 'path:People', color: { a: 1, rgb: 2272250 } },
      ],
      nodeSizeMultiplier: 1.2, lineSizeMultiplier: 1, centerStrength: 0.4,
      repelStrength: 12, linkStrength: 1, linkDistance: 250,
    },
  }
  for (const [name, val] of Object.entries(files)) await fs.writeFile(path.join(dir, name), JSON.stringify(val, null, 2), 'utf-8')
}

main().catch((e) => { console.error('Build failed:', e); process.exit(1) })
