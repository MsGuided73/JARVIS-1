// Convert Payload/Lexical rich-text JSON (content.root) into Markdown.
// Also collects internal frankreport.com links so the vault can wikilink articles.

const FORMAT = { BOLD: 1, ITALIC: 2, STRIKE: 4, UNDERLINE: 8, CODE: 16 }

function wrapInline(text, format) {
  if (!text) return text
  let out = text
  if (format & FORMAT.CODE) out = '`' + out + '`'
  if (format & FORMAT.BOLD) out = '**' + out + '**'
  if (format & FORMAT.ITALIC) out = '*' + out + '*'
  if (format & FORMAT.STRIKE) out = '~~' + out + '~~'
  return out
}

// Extract the slug from a frankreport.com / artvoice.com URL (sister sites that
// share article slugs), or null if external/non-article.
export function internalSlug(url) {
  if (!url) return null
  try {
    const u = new URL(url, 'https://frankreport.com')
    const host = u.hostname.replace(/^www\./, '')
    if (!/^(frankreport|artvoice)\.com$/i.test(host)) return null
    const seg = u.pathname.replace(/^\/+|\/+$/g, '')
    if (!seg || seg.includes('/')) return null // only top-level article slugs
    if (['category', 'tag', 'author', 'page'].includes(seg)) return null
    return seg
  } catch {
    return null
  }
}

// Render inline children (text, links) to a Markdown string.
function renderInline(nodes, ctx) {
  let out = ''
  for (const n of nodes || []) {
    switch (n.type) {
      case 'text':
        out += wrapInline(n.text ?? '', n.format ?? 0)
        break
      case 'linebreak':
        out += '\n'
        break
      case 'link':
      case 'autolink': {
        const f = n.fields || {}
        const label = renderInline(n.children, ctx) || f.url || ''
        const url = f.url || ''
        const slug = internalSlug(url)
        const noteName = slug ? ctx.resolveSlug(slug) : null
        if (noteName) {
          ctx.internalLinks.add(slug)
          out += noteName === label ? `[[${noteName}]]` : `[[${noteName}|${label}]]`
        } else if (url) {
          out += `[${label}](${url})`
        } else {
          out += label
        }
        break
      }
      default:
        if (n.children) out += renderInline(n.children, ctx)
        else if (n.text) out += n.text
    }
  }
  return out
}

function renderBlock(node, ctx, depth = 0) {
  switch (node.type) {
    case 'root':
      return (node.children || []).map((c) => renderBlock(c, ctx, depth)).join('\n\n')
    case 'heading': {
      const level = Math.min(6, Number(String(node.tag || 'h2').replace('h', '')) || 2)
      return '#'.repeat(level) + ' ' + renderInline(node.children, ctx).trim()
    }
    case 'paragraph': {
      const t = renderInline(node.children, ctx).trim()
      return t
    }
    case 'quote':
      return renderInline(node.children, ctx)
        .trim()
        .split('\n')
        .map((l) => '> ' + l)
        .join('\n')
    case 'list': {
      const ordered = node.listType === 'number'
      return (node.children || [])
        .map((li, i) => {
          const bullet = ordered ? `${i + 1}.` : '-'
          const inner = renderInline(li.children, ctx).trim()
          return '  '.repeat(depth) + `${bullet} ${inner}`
        })
        .join('\n')
    }
    case 'listitem':
      return renderInline(node.children, ctx).trim()
    case 'horizontalrule':
      return '---'
    case 'upload': {
      const v = node.value || {}
      const url = v.url || v.filename || ''
      const alt = v.alt || v.title || 'image'
      return url ? `![${alt}](${url.startsWith('http') ? url : 'https://frankreport.com' + url})` : ''
    }
    case 'block':
      // Custom Payload blocks — render any nested rich text we can find.
      if (node.fields && node.fields.content && node.fields.content.root) {
        return renderBlock(node.fields.content.root, ctx, depth)
      }
      return ''
    default:
      if (node.children) return (node.children || []).map((c) => renderBlock(c, ctx, depth)).join('\n\n')
      return ''
  }
}

// Returns { markdown, internalLinks: Set<slug> }
// opts.resolveSlug(slug) -> note name if the article exists in the vault, else null.
export function lexicalToMarkdown(content, opts = {}) {
  const ctx = { internalLinks: new Set(), resolveSlug: opts.resolveSlug || (() => null) }
  if (!content || !content.root) return { markdown: '', internalLinks: ctx.internalLinks }
  const md = renderBlock(content.root, ctx)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { markdown: md, internalLinks: ctx.internalLinks }
}

// Plain text extraction (for entity scanning), strips formatting.
export function lexicalToText(content) {
  let out = ''
  const walk = (n) => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n === 'object') {
      if (n.type === 'text' && n.text) out += n.text + ' '
      if (n.children) walk(n.children)
      if (n.root) walk(n.root)
    }
  }
  walk(content)
  return out.replace(/\s+/g, ' ').trim()
}
