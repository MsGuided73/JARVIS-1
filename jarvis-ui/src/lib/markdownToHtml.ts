// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

// Minimal, safe Markdown → HTML for the print/PDF reports. Scoped to the
// constructs the vault notes actually use (headings, lists, blockquotes, rules,
// bold/italic, links, wikilinks). All text is HTML-escaped; only http(s) links
// are emitted as anchors. Not a general-purpose Markdown engine.

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Inline formatting on an already-trusted-as-text string.
function inline(s: string): string {
  let t = escapeHtml(s)
  // Wikilinks: [[target|alias]] -> alias, [[target]] -> target (no navigation in PDF)
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1')
  // Markdown links [text](url) — only allow http(s)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) =>
    /^https?:\/\//i.test(url) ? `<a href="${escapeHtml(url)}">${text}</a>` : text,
  )
  // Bold then italic
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return t
}

export function markdownToHtml(md: string): string {
  // Drop YAML frontmatter.
  const src = md.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const lines = src.split('\n')
  const out: string[] = []
  let listTag: 'ul' | 'ol' | '' = ''
  const closeList = () => { if (listTag) { out.push(`</${listTag}>`); listTag = '' } }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { closeList(); continue }

    let m: RegExpMatchArray | null
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList()
      const n = m[1].length
      out.push(`<h${n}>${inline(m[2])}</h${n}>`)
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList()
      out.push('<hr>')
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      closeList()
      out.push(`<blockquote>${inline(m[1])}</blockquote>`)
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (listTag !== 'ul') { closeList(); out.push('<ul>'); listTag = 'ul' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      if (listTag !== 'ol') { closeList(); out.push('<ol>'); listTag = 'ol' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('\n')
}
