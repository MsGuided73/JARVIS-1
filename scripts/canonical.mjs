// Entity canonicalization + typing + containment for the Frank Report vault.
// - collapses possessives / titles / surname variants into one canonical entity
// - assigns a type (People, Judges, Organizations, Government, Legal, Places, Programs, Families)
// - models parent→child containment (DOS→NXIVM, Clare Bronfman→Bronfman, county DA→county)

// Leading titles to strip when deriving a person's canonical name.
const TITLES = [
  'President', 'Vice President', 'Judge', 'Master', 'Mayor',
  'Senator', 'Sen', 'Representative', 'Rep', 'Governor', 'Gov', 'Congressman',
  'Dr', 'Doctor', 'Professor', 'Prof', 'Mr', 'Mrs', 'Ms', 'Detective', 'Det',
  'Officer', 'Sergeant', 'Sgt', 'Agent', 'Director', 'Former DA', 'DA',
  'Attorney', 'Defendant', 'Former', 'Chief', 'Captain', 'Lieutenant', 'Lt',
]
const TITLE_RE = new RegExp(`^(?:${TITLES.join('|')})\\.?\\s+`, 'i')

// Curated containment: child entity -> parent entity.
export const CONTAINMENT = {
  DOS: 'NXIVM',
  ESP: 'NXIVM',
  'Executive Success Programs': 'NXIVM',
  Jness: 'NXIVM',
  'Society of Protectors': 'NXIVM',
  SOP: 'NXIVM',
  'Rainbow Cultural Garden': 'NXIVM',
  'The Source': 'NXIVM',
  'Slave Women of DOS': 'DOS',
  'V-Week': 'NXIVM',
  Vanguard: 'NXIVM',
}

// Program/org names in the NXIVM family (typed as Programs).
const PROGRAMS = new Set([
  'NXIVM', 'DOS', 'ESP', 'Executive Success Programs', 'Jness',
  'Society of Protectors', 'SOP', 'Rainbow Cultural Garden', 'The Source',
  'Slave Women of DOS', 'OneTaste',
])

export function stripPossessive(s) {
  return s.replace(/[''’]s$/i, '').replace(/[''’]$/, '').trim()
}

// Canonical person/name form: strip possessive + a single leading title.
export function canonicalName(raw) {
  let s = stripPossessive(raw)
  const stripped = s.replace(TITLE_RE, '').trim()
  return stripped.length >= 2 ? stripped : s
}

// Explicit type overrides for names whose type isn't inferable from markers.
const TYPE_OVERRIDE = {
  'United States': 'Places', 'United Kingdom': 'Places', 'New York': 'Places',
  'Los Angeles': 'Places', 'San Francisco': 'Places', 'Middle East': 'Places',
  'Niagara Falls': 'Places', 'Staten Island': 'Places', 'Wall Street': 'Places',
  'Penn State': 'Organizations', 'Frank Report': 'Organizations', 'Artvoice': 'Organizations',
  'Second Mile': 'Organizations', 'Social Security': 'Government', 'White House': 'Government',
  'Supreme Court': 'Legal',
}

// Type classification from a (canonical) name.
export function entityType(name, { wasJudge = false } = {}) {
  if (TYPE_OVERRIDE[name]) return TYPE_OVERRIDE[name]
  if (wasJudge) return 'Judges'
  if (PROGRAMS.has(name)) return 'Programs'
  if (/\b(Court|Circuit|Tribunal)\b/.test(name) || /\bDistrict\b/.test(name)) return 'Legal'
  if (/\b(Department|Commission|Bureau|Senate|Congress|Pentagon|FBI|SEC|DOJ|Attorney General|District Attorney)\b/.test(name)) return 'Government'
  if (/\b(County|City|Falls|Island|Road|Street|Avenue|Beach|Lake|River|Park|Penitentiary|Prison|USP|FCI|Detention Center|Metropolitan Detention)\b/.test(name)) return 'Places'
  if (/\b(Inc|LLC|Corp|Company|Group|Productions|Rescue|Foundation|University|College|Institute|Network|Media|Partners|Capital|Management|Bank|Mile|Center)\b/.test(name)) return 'Organizations'
  // Two+ capitalized tokens with no org/place markers → person.
  if (/^[A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+)+$/.test(name)) return 'People'
  if (/^[A-Z]{2,}$/.test(name)) return 'Organizations' // bare acronym
  return 'People' // single surname etc. default to people
}

// Consolidate a raw entity map (Map<rawName, Set<slug>>) into canonical entities.
// Returns { entities: Map<canon, {type, slugs:Set, parent:string|null}>,
//           slugEntities: Map<slug, Set<canon>> }
export function consolidate(rawMap) {
  // 1. First pass: canonicalize each raw name, remember judge-ness, union slugs.
  const byCanon = new Map() // canon -> { slugs:Set, judge:bool, forms:Map<form,count> }
  for (const [raw, slugs] of rawMap) {
    // "Judge X" → judge. "Justice X" too, but NOT "Justice Department" (that's Government).
    const wasJudge = /^Judge\b/i.test(raw) || (/^Justice\b/i.test(raw) && !/Justice\s+(Department|Dept)/i.test(raw))
    const canon = canonicalName(raw)
    if (!byCanon.has(canon)) byCanon.set(canon, { slugs: new Set(), judge: false, forms: new Map() })
    const rec = byCanon.get(canon)
    for (const s of slugs) rec.slugs.add(s)
    rec.judge = rec.judge || wasJudge
    rec.forms.set(canon, (rec.forms.get(canon) || 0) + slugs.size)
  }

  // 2. Merge middle-name + surname variants into full names.
  const names = [...byCanon.keys()]
  const persons = names.filter((n) => /\s/.test(n) && entityType(n, { wasJudge: byCanon.get(n).judge }) === 'People' || byCanon.get(n).judge)
  // index: lastToken -> [fullNames], (first,last) -> [fullNames]
  const byLast = new Map()
  const byFirstLast = new Map()
  for (const n of persons) {
    const toks = n.split(/\s+/)
    if (toks.length < 2) continue
    const last = toks[toks.length - 1].toLowerCase()
    const fl = `${toks[0].toLowerCase()} ${last}`
    if (!byLast.has(last)) byLast.set(last, new Set())
    byLast.get(last).add(n)
    if (!byFirstLast.has(fl)) byFirstLast.set(fl, new Set())
    byFirstLast.get(fl).add(n)
  }

  const alias = new Map() // canon -> targetCanon (merge source into target)
  const family = new Map() // surname -> Set(memberCanon)  (ambiguous surnames)

  // 2a. Collapse same (first,last) clusters (middle-name variants) to most-frequent form.
  for (const [, forms] of byFirstLast) {
    if (forms.size < 2) continue
    const best = [...forms].sort((a, b) => byCanon.get(b).slugs.size - byCanon.get(a).slugs.size)[0]
    for (const f of forms) if (f !== best) alias.set(f, best)
  }

  // 2b. Single-token surnames: merge into unique full name, else make a family hub.
  for (const n of names) {
    if (/\s/.test(n)) continue // only single tokens
    const last = n.toLowerCase()
    const fulls = byLast.get(last)
    if (!fulls || fulls.size === 0) continue
    // resolve each full through existing aliases
    const resolved = new Set([...fulls].map((f) => alias.get(f) || f))
    if (resolved.size === 1) {
      alias.set(n, [...resolved][0]) // unambiguous → merge surname into the person
    } else {
      // ambiguous surname → family hub; members get a parent link
      family.set(n, resolved)
    }
  }

  // 3. Build final entity map applying aliases.
  const resolve = (name) => {
    let cur = name, guard = 0
    while (alias.has(cur) && guard++ < 5) cur = alias.get(cur)
    return cur
  }

  const entities = new Map()
  const slugEntities = new Map()
  const ensure = (name) => {
    if (!entities.has(name)) {
      const judge = byCanon.get(name)?.judge || false
      entities.set(name, { type: entityType(name, { wasJudge: judge }), slugs: new Set(), parent: null, aliases: new Set() })
    }
    return entities.get(name)
  }

  for (const [canon, rec] of byCanon) {
    const target = resolve(canon)
    const ent = ensure(target)
    if (canon !== target) ent.aliases.add(canon) // record the variant that merged in
    for (const s of rec.slugs) {
      ent.slugs.add(s)
      if (!slugEntities.has(s)) slugEntities.set(s, new Set())
      slugEntities.get(s).add(target)
    }
  }

  // 4. Containment: curated map + families + county-DA pattern.
  const setParent = (child, parent) => {
    if (entities.has(child) && child !== parent) entities.get(child).parent = parent
  }
  for (const [child, parent] of Object.entries(CONTAINMENT)) {
    if (entities.has(child)) {
      ensure(parent).type = entities.get(parent)?.type === 'People' ? entities.get(parent).type : 'Programs'
      setParent(child, parent)
    }
  }
  // families
  for (const [surname, members] of family) {
    const hub = ensure(surname)
    hub.type = 'Families'
    for (const m of members) if (entities.has(m)) setParent(m, surname)
    // attach slugs from any surviving surname mentions already merged in
  }
  // county / jurisdiction pattern: "X County District Attorney" -> "X County"
  for (const name of entities.keys()) {
    const m = name.match(/^(.*\bCounty)\b.+(District Attorney|Sheriff|Court)/i)
    if (m && entities.has(m[1])) setParent(name, m[1])
  }

  return { entities, slugEntities }
}
