// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useEffect, useRef, useState, useCallback } from 'react'
import type { GraphNode } from '../hooks/useVaultGraph'

interface ContentResult {
  id: string
  title: string
  folder: string
  tags: string[]
  snippet: string
  score: number
  matchType: 'content'
}

interface SemanticResult {
  id: string
  label: string
  score: number
  excerpt: string
}

interface SearchBarProps {
  visible: boolean
  allNodes: GraphNode[]
  allTags: string[]
  onResults: (results: string[] | null) => void
  onNavigate: (nodeId: string) => void
  onClose: () => void
  onTagIsolate?: (ids: Set<string>, tags: string[]) => void
}

export function SearchBar({ visible, allNodes, allTags, onResults, onNavigate, onClose, onTagIsolate }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GraphNode[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [contentResults, setContentResults] = useState<ContentResult[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([])
  const [semanticLoading, setSemanticLoading] = useState(false)
  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const semanticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Click-outside to close ────────────────────────────────────────────────
  // Use a ref so the effect doesn't re-attach on every render (onClose is an
  // unstable inline arrow in the parent).  Capture-phase pointerdown fires
  // before OrbitControls' setPointerCapture can redirect subsequent events,
  // guaranteeing we always see clicks on the Three.js canvas.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!visible) return
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [visible])

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setTagSuggestions([])
      setContentResults([])
      setContentLoading(false)
      setSemanticResults([])
      setSemanticLoading(false)
      onResults(null)
    }
  }, [visible, onResults])

  // Debounced content search via API
  const fetchContentResults = useCallback((q: string, titleIds: Set<string>) => {
    if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current)
    if (!q.trim() || q.trim().startsWith('#')) {
      setContentResults([])
      setContentLoading(false)
      return
    }
    setContentLoading(true)
    contentDebounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/search/content?q=${encodeURIComponent(q)}&limit=10`)
        if (!resp.ok) throw new Error('search failed')
        const data = await resp.json() as { results: ContentResult[] }
        // Deduplicate: exclude IDs already found by title search
        setContentResults(data.results.filter(r => !titleIds.has(r.id)).slice(0, 5))
      } catch {
        setContentResults([])
      } finally {
        setContentLoading(false)
      }
    }, 300)
  }, [])

  // Debounced semantic search via API
  const fetchSemanticResults = useCallback((q: string) => {
    if (semanticDebounceRef.current) clearTimeout(semanticDebounceRef.current)
    setSemanticLoading(true)
    semanticDebounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/semantic-search?q=${encodeURIComponent(q)}`)
        if (!resp.ok) throw new Error('semantic search failed')
        const data = await resp.json() as { results: SemanticResult[]; ready: boolean }
        if (!data.ready) {
          setSemanticResults([])
        } else {
          setSemanticResults(data.results.slice(0, 10))
        }
      } catch {
        setSemanticResults([])
      } finally {
        setSemanticLoading(false)
      }
    }, 400)
  }, [])

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      onResults(null)
      setResults([])
      setTagSuggestions([])
      setContentResults([])
      setContentLoading(false)
      setSemanticResults([])
      setSemanticLoading(false)
      return
    }

    const raw = q.trim()

    // ── Semantic search mode (~ prefix) ──────────────────────────────────
    if (raw.startsWith('~')) {
      const semanticQuery = raw.slice(1).trim()
      setResults([])
      setTagSuggestions([])
      setContentResults([])
      setContentLoading(false)
      onResults(null)
      if (semanticQuery) {
        fetchSemanticResults(semanticQuery)
      } else {
        setSemanticResults([])
        setSemanticLoading(false)
      }
      return
    }

    // Clear semantic results for non-semantic queries
    setSemanticResults([])
    setSemanticLoading(false)

    const terms = raw.toLowerCase().split(/\s+/)

    // ── Tag autosuggest ────────────────────────────────────────────────────
    // Show tag suggestions for any query:
    //   - If last token starts with '#', complete that fragment
    //   - Otherwise, suggest tags that contain the last token
    const lastToken = terms[terms.length - 1] ?? ''
    const tagFragment = lastToken.startsWith('#') ? lastToken.slice(1) : lastToken
    const suggestions = allTags
      .filter(t => {
        const tl = t.toLowerCase()
        return tagFragment.length >= 1 && tl.includes(tagFragment.toLowerCase())
      })
      .sort((a, b) => {
        // Prefer starts-with over contains
        const al = a.toLowerCase(), bl = b.toLowerCase(), fl = tagFragment.toLowerCase()
        const aStarts = al.startsWith(fl), bStarts = bl.startsWith(fl)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return a.localeCompare(b)
      })
      .slice(0, 8)
    setTagSuggestions(suggestions)

    // ── Note search ────────────────────────────────────────────────────────
    const tagTerms = terms.filter(t => t.startsWith('#')).map(t => t.slice(1))
    const textTerms = terms.filter(t => !t.startsWith('#'))

    const matched = allNodes.filter(node => {
      if (tagTerms.length > 0) {
        const nodeTags = node.tags.map(t => t.toLowerCase())
        if (!tagTerms.every(tt => nodeTags.some(nt => nt.includes(tt)))) return false
      }
      if (textTerms.length > 0) {
        const searchText = `${node.label} ${node.excerpt} ${node.id}`.toLowerCase()
        if (!textTerms.every(t => searchText.includes(t))) return false
      }
      return true
    }).slice(0, 20)

    setResults(matched)
    setSelectedIdx(0)
    onResults(matched.map(n => n.id))

    // Fire content search (skip for pure tag queries)
    const isTagOnly = terms.every(t => t.startsWith('#'))
    if (!isTagOnly) {
      fetchContentResults(raw, new Set(matched.map(n => n.id)))
    } else {
      setContentResults([])
      setContentLoading(false)
    }
  }, [allNodes, allTags, onResults, fetchContentResults, fetchSemanticResults])

  useEffect(() => {
    search(query)
  }, [query, search])

  const applyTagSuggestion = (tag: string) => {
    const terms = query.split(/\s+/)
    const lastToken = terms[terms.length - 1] ?? ''
    // Replace last token with the completed tag
    terms[terms.length - 1] = lastToken.startsWith('#') ? `#${tag} ` : `#${tag} `
    setQuery(terms.join(' '))
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      onResults(null)
      inputRef.current?.blur()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Tab' && tagSuggestions.length > 0) {
      // Tab completes the first tag suggestion
      e.preventDefault()
      applyTagSuggestion(tagSuggestions[0])
    } else if (e.key === 'Enter') {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0)
      const isTagOnly = terms.length > 0 && terms.every(t => t.startsWith('#'))
      if (isTagOnly && onTagIsolate) {
        const tagTerms = terms.map(t => t.slice(1))
        const matchedIds = new Set(
          allNodes
            .filter(n => {
              const nodeTags = n.tags.map(t => t.toLowerCase())
              return tagTerms.every(tt => nodeTags.some(nt => nt.includes(tt)))
            })
            .map(n => n.id)
        )
        onTagIsolate(matchedIds, tagTerms)
        onClose()
      } else if (results.length > 0) {
        onNavigate(results[selectedIdx].id)
      }
    }
  }

  const isSemanticMode = query.trim().startsWith('~')
  const hasDropdown = tagSuggestions.length > 0 || results.length > 0 || contentResults.length > 0 || contentLoading || semanticResults.length > 0 || semanticLoading || (!!query && results.length === 0 && !contentLoading && contentResults.length === 0 && !semanticLoading && semanticResults.length === 0)

  return (
    <>
      <style>{`.jarvis-snippet mark { background: rgb(var(--accent-rgb) / 0.13); color: var(--accent); border-radius: 2px; padding: 0 1px; }`}</style>
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        width: 480,
      }}
    >
      <div style={{
        background: 'var(--panel-strong)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--accent)',
        borderRadius: hasDropdown ? '6px 6px 0 0' : 6,
        boxShadow: '0 0 20px rgb(var(--accent-rgb) / 0.2)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
          <span style={{ color: 'var(--accent)', fontSize: 16, marginRight: 8 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes… #tag  ~semantic  (Tab to complete)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              padding: '12px 0',
            }}
          />
          {query && (
            <span
              style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
              onClick={onClose}
            >ESC</span>
          )}
        </div>
      </div>

      {/* ── Dropdown panel (separated so input border stays clean) ── */}
      {hasDropdown && (
        <div style={{
          background: 'var(--panel-strong)',
          backdropFilter: 'var(--panel-blur)',
          WebkitBackdropFilter: 'var(--panel-blur)',
          border: '1px solid var(--accent)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          boxShadow: '0 8px 20px #00000088',
          overflow: 'hidden',
        }}>

          {/* Tag suggestions */}
          {tagSuggestions.length > 0 && (
            <div style={{ padding: '6px 10px', borderBottom: results.length > 0 ? '1px solid var(--surface-raised)' : 'none' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>TAGS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tagSuggestions.map((tag, i) => (
                  <span
                    key={tag}
                    style={{
                      background: i === 0 ? '#1a2d1a' : '#111820',
                      color: i === 0 ? 'var(--success)' : '#6b8a6b',
                      border: `1px solid ${i === 0 ? 'color-mix(in srgb, var(--success) 33%, transparent)' : '#2a3a2a'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 9px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.background = '#1a2d1a'
                      el.style.color = 'var(--success)'
                      el.style.borderColor = 'color-mix(in srgb, var(--success) 33%, transparent)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      if (i !== 0) {
                        el.style.background = '#111820'
                        el.style.color = '#6b8a6b'
                        el.style.borderColor = '#2a3a2a'
                      }
                    }}
                    onClick={() => applyTagSuggestion(tag)}
                    title={i === 0 ? 'Tab to complete' : undefined}
                  >
                    #{tag}{i === 0 ? <span style={{ color: '#3a5a3a', fontSize: 10, marginLeft: 4 }}>Tab</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tag-only query: Enter to isolate */}
          {query.trim().startsWith('#') && onTagIsolate && (() => {
            const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0)
            const tagTerms = terms.filter(t => t.startsWith('#')).map(t => t.slice(1))
            const textTerms = terms.filter(t => !t.startsWith('#'))
            if (tagTerms.length === 0 || textTerms.length > 0) return null
            const matchCount = allNodes.filter(n => {
              const nodeTags = n.tags.map(t => t.toLowerCase())
              return tagTerms.every(tt => nodeTags.some(nt => nt.includes(tt)))
            }).length
            return (
              <div
                onClick={() => {
                  const matchedIds = new Set(
                    allNodes.filter(n => {
                      const nodeTags = n.tags.map(t => t.toLowerCase())
                      return tagTerms.every(tt => nodeTags.some(nt => nt.includes(tt)))
                    }).map(n => n.id)
                  )
                  onTagIsolate(matchedIds, tagTerms)
                  onClose()
                }}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  background: '#0f1a0f',
                  borderTop: '1px solid var(--surface-raised)',
                  borderLeft: '2px solid var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: 'var(--success)', fontSize: 13 }}>
                  Filter: {tagTerms.map(t => `#${t}`).join(' ')}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{matchCount} nodes</span>
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Enter ↵</span>
              </div>
            )
          })()}

          {/* Note results */}
          {results.length > 0 && (
            <div style={{ borderTop: tagSuggestions.length > 0 ? '1px solid var(--surface-raised)' : 'none', maxHeight: 280, overflowY: 'auto' }}>
              {results.map((node, i) => (
                <div
                  key={node.id}
                  onClick={() => onNavigate(node.id)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    background: i === selectedIdx ? 'rgb(var(--accent-rgb) / 0.08)' : 'transparent',
                    borderLeft: i === selectedIdx ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ color: i === selectedIdx ? 'var(--accent)' : 'var(--text)', fontSize: 13 }}>
                    {node.label}
                  </div>
                  {node.tags.length > 0 && (
                    <div style={{ color: 'var(--success)', fontSize: 11, marginTop: 2 }}>
                      {node.tags.slice(0, 3).map(t => `#${t}`).join(' ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content search section */}
          {(contentLoading || contentResults.length > 0) && (
            <div style={{ borderTop: '1px solid var(--surface-raised)' }}>
              {/* Divider */}
              <div style={{
                padding: '5px 16px',
                color: 'var(--border)',
                fontSize: 11,
                letterSpacing: 1,
                userSelect: 'none',
              }}>
                ─── In content ───
              </div>

              {/* Loading state */}
              {contentLoading && contentResults.length === 0 && (
                <div style={{ padding: '6px 16px 10px', color: 'var(--border)', fontSize: 12, fontStyle: 'italic' }}>
                  [searching content…]
                </div>
              )}

              {/* Content results */}
              {contentResults.map(result => (
                <div
                  key={result.id}
                  onClick={() => onNavigate(result.id)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderLeft: '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgb(var(--accent-rgb) / 0.05)'
                    e.currentTarget.style.borderLeftColor = 'rgb(var(--accent-rgb) / 0.33)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderLeftColor = 'transparent'
                  }}
                >
                  <div style={{ color: 'var(--text)', fontSize: 13 }}>{result.title}</div>
                  <div
                    className="jarvis-snippet"
                    style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                  {result.tags.length > 0 && (
                    <div style={{ color: 'var(--success)', fontSize: 11, marginTop: 2 }}>
                      {result.tags.slice(0, 3).map(t => `#${t}`).join(' ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Semantic search section */}
          {isSemanticMode && (semanticLoading || semanticResults.length > 0) && (
            <div style={{ borderTop: '1px solid var(--surface-raised)' }}>
              <div style={{
                padding: '5px 16px',
                color: 'var(--purple)',
                fontSize: 11,
                letterSpacing: 1,
                userSelect: 'none',
              }}>
                ─── Semantic ───
              </div>

              {semanticLoading && semanticResults.length === 0 && (
                <div style={{ padding: '6px 16px 10px', color: 'var(--purple)', fontSize: 12, fontStyle: 'italic' }}>
                  Semantic search...
                </div>
              )}

              {semanticResults.map(result => (
                <div
                  key={result.id}
                  onClick={() => onNavigate(result.id)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderLeft: '2px solid transparent',
                    transition: 'background 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--purple) 5%, transparent)'
                    e.currentTarget.style.borderLeftColor = 'color-mix(in srgb, var(--purple) 33%, transparent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderLeftColor = 'transparent'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text)', fontSize: 13 }}>{result.label}</div>
                    {result.excerpt && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {result.excerpt}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: 'color-mix(in srgb, var(--purple) 13%, transparent)',
                    color: 'var(--purple)',
                    border: '1px solid color-mix(in srgb, var(--purple) 20%, transparent)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1px 6px',
                    fontSize: 10,
                    marginLeft: 8,
                    flexShrink: 0,
                  }}>
                    {Math.round(result.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {isSemanticMode && !semanticLoading && semanticResults.length === 0 && query.trim().length > 1 && (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              No semantic results
            </div>
          )}

          {!isSemanticMode && query && results.length === 0 && tagSuggestions.length === 0 && !contentLoading && contentResults.length === 0 && (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              No results
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
