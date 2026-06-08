// Entity extraction for the Frank Report vault.
// Precision-first: curated gazetteer (word-boundary matched) + corpus-driven
// MULTI-WORD Title-Case proper nouns seen in >= MIN_DF distinct articles.
// Single-word candidates are dropped (too noisy for regex NER).

export const GAZETTEER = [
  // NXIVM core (multi-word names are reliable; bare acronyms handled separately)
  'Keith Raniere', 'Allison Mack', 'Clare Bronfman', 'Sara Bronfman',
  'Nancy Salzman', 'Lauren Salzman', 'India Oxenberg', 'Catherine Oxenberg',
  'Mark Vicente', 'Sarah Edmondson', 'Bonnie Piesse', 'Kristin Keeffe',
  'Barbara Bouchey', 'Toni Natalie', 'Emiliano Salinas', 'Nicki Clyne',
  'Pam Cafritz', 'Frank Parlato',
  // Orgs / programs (multi-word)
  'Executive Success Programs', 'Rainbow Cultural Garden', 'Society of Protectors',
  // NXIVM sub-orgs / programs (short acronyms — matched case-sensitively below):
  'DOS', 'ESP', 'Jness',
  // High-value single tokens worth keeping despite single-word rule:
  'NXIVM', 'Raniere', 'Bronfman', 'Trump', 'Biden',
]

// Acronyms matched case-SENSITIVELY as whole tokens (avoid esp->ESP false hits).
const ACRONYM_GAZ = new Set(['NXIVM', 'DOS', 'ESP', 'Jness'])

const WEEKDAYS = new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
const MONTHS = new Set(['January','February','March','April','May','June','July','August','September','October','November','December'])
const STOP_FIRST = new Set([
  'The','This','That','These','Those','A','An','And','But','Or','For','Nor','Yet','So',
  'In','On','At','To','Of','By','With','As','It','He','She','They','We','You','I',
  'His','Her','Their','Our','My','Its','When','Where','While','After','Before','During',
  'Mr','Mrs','Ms','Dr','What','Whether','Both','Every','Each','Some','Three','Two','One',
  'None','More','Most','Many','Few','Over','Under','Once','Here','There','Then','Now',
  'Year','People','Both','All','Any','No','Not','New','Old','First','Last','Next',
  'American','Americans','European','African','Asian','British','French','German',
])

function norm(s) { return s.replace(/\s+/g, ' ').trim() }

// Verb/headline-fragment words that signal a Title-Case headline, not an entity.
const REJECT_ANY = new Set([
  'Has','Have','Had','Is','Are','Was','Were','Been','Being','Will','Would','Can','Could',
  'Died','Dies','Die','Dead','Killed','Kill','Kills','Said','Says','Say','Told','Tells',
  'Part','Who','Why','How','What','When','Really','Now','Just','Still','Even','About',
  'With','Without','From','Into','Over','Under','After','Before','Their','This','That',
  'Get','Gets','Got','Make','Makes','Made','Take','Takes','Took','Goes','Going','Gone',
  'Money','Yacht','War','Draft','Bowl','Award','PM','AM','Eastern',
])

// Multi-word Title-Case phrases (2-4 words), allowing lowercase connectors.
function candidatesFromText(text) {
  const found = new Set()
  const re = /\b[A-Z][a-zA-Z'’-]+(?:\.[A-Z])?(?:\s+(?:of|the|de|von|van|for)\s+[A-Z][a-zA-Z'’-]+|\s+[A-Z][a-zA-Z'’-]+){1,3}\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    // Trim at the first sentence boundary (period after a real word, not an initial).
    let phrase = norm(m[0].split(/(?<=[a-z]{2})[.?!]\s+/)[0].replace(/[.,;:'’]+$/, ''))
    phrase = phrase.replace(/[''’]s$/i, '') // drop possessive 's
    const words = phrase.split(/\s+/)
    if (words.length < 2) continue
    const first = words[0]
    if (STOP_FIRST.has(first) || WEEKDAYS.has(first) || MONTHS.has(first)) continue
    if (words.some((w) => REJECT_ANY.has(w))) continue
    if (words.every((w) => WEEKDAYS.has(w) || MONTHS.has(w) || /^\d+$/.test(w))) continue
    if (words.some((w) => WEEKDAYS.has(w)) && words.length <= 2) continue
    found.add(phrase)
  }
  return found
}

// posts: [{ slug, text }] -> Map<entityName, Set<slug>>
export function extractEntities(posts, { minDocFreq = 4 } = {}) {
  const docFreq = new Map()
  const add = (name, slug) => {
    const key = norm(name)
    if (!key) return
    if (!docFreq.has(key)) docFreq.set(key, new Set())
    docFreq.get(key).add(slug)
  }

  // Pre-build gazetteer matchers.
  const gaz = GAZETTEER.map((g) => ({
    name: g,
    // single short tokens / acronyms: case-sensitive whole word; else case-insensitive
    re: ACRONYM_GAZ.has(g)
      ? new RegExp(`\\b${g}\\b`)
      : new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }))

  for (const p of posts) {
    const text = p.text || ''
    const seen = new Set()
    for (const { name, re } of gaz) if (re.test(text)) seen.add(name)
    for (const c of candidatesFromText(text)) seen.add(c)
    for (const e of seen) add(e, p.slug)
  }

  const gazSet = new Set(GAZETTEER)
  const result = new Map()
  for (const [name, slugs] of docFreq) {
    if ((gazSet.has(name) && slugs.size >= 1) || slugs.size >= minDocFreq) {
      result.set(name, slugs)
    }
  }
  return result
}
