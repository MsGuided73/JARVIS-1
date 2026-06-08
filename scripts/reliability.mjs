// Classify each article's content type / reliability tier.
// For research validity: keep fact-reporting and primary documents distinct from
// opinion, guest views, and satire so nothing gets cited as fact that isn't.

// Categories that carry a content-TYPE signal (override the topical default).
const CATEGORY_TYPE = {
  'Satire and Fiction': 'Satire',
  'Guest Views': 'Guest-View',
  Investigations: 'Investigation',
  'NXIVM/Raniere/Bronfman Documents': 'Primary-Document',
  'NXIVM Raniere Bronfman Documents': 'Primary-Document',
}

// Higher priority wins when an article has multiple type-bearing categories.
const PRIORITY = ['Satire', 'Primary-Document', 'Investigation', 'Guest-View', 'Opinion', 'Reporting']

// Reliability tier per content type (how a researcher should weight it).
export const RELIABILITY = {
  'Primary-Document': 'primary',
  Investigation: 'high',
  Reporting: 'medium',
  Opinion: 'opinion',
  'Guest-View': 'opinion',
  Satire: 'not-factual',
}

const CONTENT_FOLDER = {
  Reporting: 'Reporting', Investigation: 'Investigations',
  'Primary-Document': 'Documents', Opinion: 'Opinion',
  'Guest-View': 'Guest-Views', Satire: 'Satire',
}

export function contentFolder(type) {
  return CONTENT_FOLDER[type] || 'Reporting'
}

// post -> { type, reliability }
export function classifyContentType(post, categoryNames = []) {
  const candidates = []
  for (const c of categoryNames) if (CATEGORY_TYPE[c]) candidates.push(CATEGORY_TYPE[c])

  const title = post.title || ''
  if (/\b(satire|fiction|parody)\b/i.test(title)) candidates.push('Satire')
  if (/^\s*(opinion|editorial|commentary)\b/i.test(title)) candidates.push('Opinion')

  let type = 'Reporting'
  for (const t of PRIORITY) {
    if (candidates.includes(t)) { type = t; break }
  }
  return { type, reliability: RELIABILITY[type] || 'medium' }
}
