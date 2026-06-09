// Multi-part series detection + curated case definitions for the Frank Report vault.

// ── Series ────────────────────────────────────────────────────────────────────
// Detect "Part N" article series and group them in reading order.

const PART_RE = /\bpart\s*#?\s*(\d+)\b/i

function normStem(s) {
  return s
    .replace(/[?:.\-–—,;]+\s*$/, '')
    .replace(/^\s*[?:.\-–—,;]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Derive the recurring series stem + part number from a title, or null.
function seriesOf(title) {
  const m = title.match(PART_RE)
  if (!m) return null
  const part = Number(m[1])
  const before = title.slice(0, m.index)
  const after = title.slice(m.index + m[0].length)
  // Prefer the side that carries the recurring name; subtitle usually follows a colon.
  let stem = normStem(before)
  if (stem.length < 10) stem = normStem(after.split(/[:–—-]/)[0])
  else stem = normStem(stem.split(/[:–—]/)[0])
  if (stem.length < 8) return null
  return { stem, part }
}

// posts -> Map<stem, [{slug, title, part}]> (sorted by part), only stems with >=2 parts.
export function detectSeries(posts) {
  const groups = new Map()
  for (const p of posts) {
    const s = seriesOf(p.title || '')
    if (!s) continue
    const key = s.stem.toLowerCase()
    if (!groups.has(key)) groups.set(key, { name: s.stem, parts: [] })
    groups.get(key).parts.push({ slug: p.slug, title: p.title, part: s.part })
  }
  const out = new Map()
  for (const [, g] of groups) {
    if (g.parts.length < 2) continue
    g.parts.sort((a, b) => a.part - b.part)
    out.set(g.name, g.parts)
  }
  return out
}

// ── Curated cases ─────────────────────────────────────────────────────────────
// Major investigations. An article belongs to a case if it has a matching
// category OR mentions one of the case's key entities.
export const CASES = [
  {
    name: 'NXIVM',
    categories: ['NXIVM', 'NXIVM/Raniere/Bronfman Documents', 'NXIVM Raniere Bronfman Documents', 'Slave Women of DOS'],
    entities: ['Keith Raniere', 'Allison Mack', 'Clare Bronfman', 'Sara Bronfman', 'Nancy Salzman', 'Lauren Salzman', 'NXIVM', 'DOS'],
  },
  {
    name: 'OneTaste',
    categories: ['OneTaste'],
    entities: ['Nicole Daedone', 'Rachel Cherwitz', 'OneTaste'],
  },
  {
    name: 'Jerry Sandusky / Penn State',
    categories: ['Sandusky'],
    entities: ['Jerry Sandusky', 'Penn State', 'Second Mile', 'Joe Paterno', 'Aaron Fisher'],
  },
  {
    // No dedicated FrankReport category — this is a title-defined series
    // ("The Framing of Honduran President Juan Orlando Hernández"), so match on
    // the title. Accent-insensitive, so "Hernandez" and "Hernández" both hit.
    name: 'Juan Orlando Hernandez / Honduras',
    categories: [],
    titles: ['juan orlando hernandez', 'honduran president juan orlando', 'show trial of juan orlando'],
    entities: ['Juan Orlando Hernández', 'Juan Orlando Hernandez', 'Tony Hernandez'],
  },
  {
    name: 'Wrongful Convictions',
    categories: ['Wrongful Convictions'],
    entities: [],
  },
  {
    name: 'Family Court / Parental Alienation',
    categories: ['Family Court', 'Parental Alienation'],
    entities: ['Christopher Ambrose'],
  },
]

// Accent-insensitive lowercasing so "Hernández" matches "hernandez".
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// How does an article match a case? 'category' is high-confidence (the whole
// article is filed under the case OR its title names the case); 'entity' is
// weaker (the article merely mentions a case figure). null = no match. Used to
// gate timeline precision.
export function caseMatchKind(caseDef, categoryNames, entityNames, title = '') {
  for (const c of categoryNames) if (caseDef.categories.includes(c)) return 'category'
  if (caseDef.titles?.length) {
    const t = norm(title)
    if (caseDef.titles.some((s) => t.includes(norm(s)))) return 'category'
  }
  for (const e of entityNames) if (caseDef.entities.includes(e)) return 'entity'
  return null
}

// Does an article belong to this case?
export function articleInCase(caseDef, categoryNames, entityNames, title = '') {
  return caseMatchKind(caseDef, categoryNames, entityNames, title) !== null
}

// Lowercased phrases that signal a sentence is about this case. Used to keep
// only on-topic dated sentences from entity-matched (weak) articles, so a
// passing mention of one case figure in an unrelated article does not pollute
// the timeline. Includes entity names, their surnames, and case-name tokens.
export function caseKeywords(caseDef) {
  const kw = new Set()
  for (const e of caseDef.entities) {
    const lo = e.toLowerCase()
    kw.add(lo)
    const surname = lo.split(/\s+/).pop()
    if (surname && surname.length >= 4) kw.add(surname)
  }
  for (const c of caseDef.categories) kw.add(c.toLowerCase())
  for (const t of caseDef.titles || []) kw.add(norm(t))
  for (const tok of caseDef.name.toLowerCase().split(/[\s/]+/)) {
    if (tok.length >= 4) kw.add(tok)
  }
  return [...kw]
}

// Does a sentence mention any of the case's signal phrases?
export function sentenceMatchesCase(sentenceLower, keywords) {
  for (const k of keywords) if (sentenceLower.includes(k)) return true
  return false
}
