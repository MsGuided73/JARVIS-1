// Extract event dates mentioned in article text, for building case chronologies.
// Distinguishes the date an EVENT happened (in the prose) from when the article
// was published. Best-effort: explicit calendar dates only, to keep precision high.

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
}
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_RE = '(January|February|March|April|May|June|July|August|September|October|November|December)'
const MIN_YEAR = 1980
const MAX_YEAR = 2026

const pad = (n) => String(n).padStart(2, '0')

// Returns { dates: [ISO 'YYYY-MM-DD'...], years: [number...] } sorted/deduped.
export function extractDates(text) {
  const dates = new Set()
  const years = new Set()
  if (!text) return { dates: [], years: [] }

  // "January 5, 2019" / "January 5 2019"
  const full = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi')
  let m
  while ((m = full.exec(text)) !== null) {
    const mo = MONTHS[m[1].toLowerCase()]
    const day = Number(m[2])
    const yr = Number(m[3])
    if (yr >= MIN_YEAR && yr <= MAX_YEAR && day >= 1 && day <= 31) {
      dates.add(`${yr}-${pad(mo)}-${pad(day)}`)
      years.add(yr)
    }
  }

  // "January 2019" (month + year, no day)
  const monthYear = new RegExp(`\\b${MONTH_RE}\\s+(\\d{4})\\b`, 'gi')
  while ((m = monthYear.exec(text)) !== null) {
    const yr = Number(m[2])
    if (yr >= MIN_YEAR && yr <= MAX_YEAR) years.add(yr)
  }

  // "5/12/2019" numeric
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g
  while ((m = numeric.exec(text)) !== null) {
    const mo = Number(m[1]), day = Number(m[2]), yr = Number(m[3])
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31 && yr >= MIN_YEAR && yr <= MAX_YEAR) {
      dates.add(`${yr}-${pad(mo)}-${pad(day)}`)
      years.add(yr)
    }
  }

  // Bare years
  const yearRe = /\b(19[89]\d|20[0-2]\d)\b/g
  while ((m = yearRe.exec(text)) !== null) {
    const yr = Number(m[1])
    if (yr >= MIN_YEAR && yr <= MAX_YEAR) years.add(yr)
  }

  return {
    dates: [...dates].sort(),
    years: [...years].sort((a, b) => a - b),
  }
}

// ── Event extraction (date + what happened) ──────────────────────────────────
// For a case timeline we want not just the date but the sentence describing the
// event. We scan sentence-by-sentence, pull the first explicit calendar date in
// each, and keep the surrounding prose as the event description.

const SENTENCE_SPLIT = /(?<=[.!?"”’])\s+(?=[A-Z"'“‘])/

// Find the first explicit calendar date in a sentence.
// Returns { iso, display, precision } or null. `iso` is always a sortable
// 'YYYY-MM-DD' (month-only dates pin to day 01); `display` is human-readable.
function firstDate(sentence) {
  // Full date: "January 5, 2019"
  const full = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i').exec(sentence)
  // Numeric date: "5/12/2019"
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(sentence)
  // Month + year: "January 2019"
  const monthYear = new RegExp(`\\b${MONTH_RE}\\s+(\\d{4})\\b`, 'i').exec(sentence)

  // Prefer the earliest-positioned, most-precise match.
  const candidates = []
  if (full) {
    const mo = MONTHS[full[1].toLowerCase()], day = Number(full[2]), yr = Number(full[3])
    if (yr >= MIN_YEAR && yr <= MAX_YEAR && day >= 1 && day <= 31) {
      candidates.push({ index: full.index, iso: `${yr}-${pad(mo)}-${pad(day)}`, display: `${MONTH_NAMES[mo]} ${day}, ${yr}`, precision: 'day' })
    }
  }
  if (numeric) {
    const mo = Number(numeric[1]), day = Number(numeric[2]), yr = Number(numeric[3])
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31 && yr >= MIN_YEAR && yr <= MAX_YEAR) {
      candidates.push({ index: numeric.index, iso: `${yr}-${pad(mo)}-${pad(day)}`, display: `${MONTH_NAMES[mo]} ${day}, ${yr}`, precision: 'day' })
    }
  }
  if (monthYear) {
    const mo = MONTHS[monthYear[1].toLowerCase()], yr = Number(monthYear[2])
    if (yr >= MIN_YEAR && yr <= MAX_YEAR) {
      candidates.push({ index: monthYear.index, iso: `${yr}-${pad(mo)}-01`, display: `${MONTH_NAMES[mo]} ${yr}`, precision: 'month' })
    }
  }
  if (!candidates.length) return null
  // Earliest position wins; on tie prefer a full date over a month-only one.
  candidates.sort((a, b) => a.index - b.index || (a.precision === 'day' ? -1 : 1))
  return candidates[0]
}

// Tidy a sentence into a readable one-line event description.
function cleanDescription(sentence) {
  return sentence
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“‘\-–—•]+/, '')
    .trim()
    .slice(0, 240)
    .replace(/\s+\S*$/, (m) => (sentence.length > 240 ? '…' : m)) // avoid mid-word cut when truncated
    .trim()
}

// Returns [{ iso, display, precision, description }] for sentences that carry an
// explicit date, de-duplicated by iso+description and sorted chronologically.
export function extractEvents(text) {
  if (!text) return []
  const seen = new Set()
  const out = []
  for (const raw of text.split(SENTENCE_SPLIT)) {
    const sentence = raw.trim()
    if (sentence.length < 12) continue
    const d = firstDate(sentence)
    if (!d) continue
    const description = cleanDescription(sentence)
    if (description.length < 12) continue
    const key = `${d.iso}|${description.slice(0, 80).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ iso: d.iso, display: d.display, precision: d.precision, description })
  }
  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
  return out
}
