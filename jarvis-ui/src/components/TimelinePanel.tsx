// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useEffect, useMemo, useState } from 'react'

interface TimelineEvent {
  date: string        // sortable ISO 'YYYY-MM-DD'
  display: string     // human-readable, e.g. "January 5, 2019" or "June 2017"
  precision: 'day' | 'month'
  description: string
  note: string        // source note base-name (navigable)
}

interface CaseTimeline {
  name: string
  note: string
  articleCount: number
  span: string
  events: TimelineEvent[]
}

interface TimelinePanelProps {
  open: boolean
  initialCase?: string | null
  onClose: () => void
  onNavigate: (noteName: string) => void
}

const ACCENT = '#00d4ff'

const surface = (alpha: number) => `rgba(17, 19, 28, ${alpha})`

function yearOf(iso: string): string {
  return iso.slice(0, 4)
}

export function TimelinePanel({ open, initialCase, onClose, onNavigate }: TimelinePanelProps) {
  const [cases, setCases] = useState<CaseTimeline[] | null>(null)
  const [activeCase, setActiveCase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load timelines once the panel is first opened.
  useEffect(() => {
    if (!open || cases) return
    const controller = new AbortController()
    fetch('/api/timeline', { signal: controller.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((data: { cases: CaseTimeline[] }) => {
        setCases(data.cases)
        setError(null)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError('Timeline data unavailable. Rebuild the vault (npm run build).')
      })
    return () => controller.abort()
  }, [open, cases])

  // Pick the active case: requested one if present, else the richest timeline.
  useEffect(() => {
    if (!open || !cases || cases.length === 0) return
    setActiveCase(prev => {
      if (initialCase) {
        const match = cases.find(c => c.name.toLowerCase() === initialCase.toLowerCase())
        if (match) return match.name
      }
      if (prev && cases.some(c => c.name === prev)) return prev
      return [...cases].sort((a, b) => b.events.length - a.events.length)[0].name
    })
  }, [open, cases, initialCase])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const current = useMemo(
    () => cases?.find(c => c.name === activeCase) ?? null,
    [cases, activeCase],
  )

  // Group the active case's events by year for visual rhythm.
  const grouped = useMemo(() => {
    if (!current) return []
    const byYear = new Map<string, TimelineEvent[]>()
    for (const ev of current.events) {
      const y = yearOf(ev.date)
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(ev)
    }
    return [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [current])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(720px, 92vw)', height: 'min(82vh, 900px)',
          display: 'flex', flexDirection: 'column',
          background: surface(0.96),
          border: `1px solid ${ACCENT}55`,
          borderRadius: 10,
          boxShadow: `0 0 40px ${ACCENT}22, 0 20px 60px rgba(0,0,0,0.6)`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #2a2d3a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              fontFamily: '"Courier New", monospace', fontSize: 12, letterSpacing: 2,
              color: ACCENT, textTransform: 'uppercase',
            }}>
              ⏱ Case Timeline
            </div>
            <button
              onClick={onClose}
              title="Close (Esc)"
              style={{
                background: 'transparent', border: 'none', color: '#a6adc8',
                fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4,
              }}
            >×</button>
          </div>

          {/* Case selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {(cases ?? []).map(c => {
              const isActive = c.name === activeCase
              return (
                <button
                  key={c.name}
                  onClick={() => setActiveCase(c.name)}
                  title={`${c.events.length} events · ${c.articleCount} articles`}
                  style={{
                    background: isActive ? `${ACCENT}1f` : 'transparent',
                    border: `1px solid ${isActive ? ACCENT : '#3a3d4a'}`,
                    color: isActive ? ACCENT : '#a6adc8',
                    borderRadius: 999, padding: '4px 12px', fontSize: 12,
                    cursor: 'pointer', transition: 'all 120ms ease',
                  }}
                >
                  {c.name}
                  <span style={{ opacity: 0.6, marginLeft: 6 }}>{c.events.length}</span>
                </button>
              )
            })}
          </div>

          {current && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span
                onClick={() => { onNavigate(current.note); onClose() }}
                title="Open case file in graph"
                style={{ fontSize: 18, fontWeight: 600, color: '#dcddde', cursor: 'pointer' }}
              >
                {current.name}
              </span>
              <span style={{ fontFamily: '"Courier New", monospace', fontSize: 12, color: '#7a7f95' }}>
                {current.span} · {current.events.length} dated events
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px' }}>
          {error && (
            <div style={{ color: '#f38ba8', fontSize: 13, padding: '24px 0' }}>{error}</div>
          )}
          {!error && !cases && (
            <div style={{ color: '#7a7f95', fontSize: 13, padding: '24px 0' }}>Loading timeline…</div>
          )}
          {!error && current && current.events.length === 0 && (
            <div style={{ color: '#7a7f95', fontSize: 13, padding: '24px 0' }}>
              No dated events were extracted for this case.
            </div>
          )}

          {!error && current && grouped.map(([year, events]) => (
            <div key={year} style={{ marginTop: 18 }}>
              <div style={{
                fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 700,
                color: ACCENT, letterSpacing: 1, marginBottom: 8,
                position: 'sticky', top: 0, background: surface(0.96), padding: '2px 0', zIndex: 1,
              }}>
                {year}
              </div>

              {/* Rail + events */}
              <div style={{ borderLeft: `1px solid ${ACCENT}33`, marginLeft: 6, paddingLeft: 16 }}>
                {events.map((ev, i) => (
                  <div key={`${ev.date}-${i}`} style={{ position: 'relative', paddingBottom: 14 }}>
                    {/* node dot */}
                    <span style={{
                      position: 'absolute', left: -22, top: 5, width: 7, height: 7,
                      borderRadius: '50%', background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`,
                    }} />
                    <div style={{
                      fontFamily: '"Courier New", monospace', fontSize: 11,
                      color: ev.precision === 'day' ? ACCENT : '#7fb8c9', marginBottom: 2,
                    }}>
                      {ev.display}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#dcddde' }}>
                      {ev.description}
                    </div>
                    <span
                      onClick={() => { onNavigate(ev.note); onClose() }}
                      title="Open source article in graph"
                      style={{
                        display: 'inline-block', marginTop: 3, fontSize: 11,
                        color: '#7a7f95', cursor: 'pointer', borderBottom: '1px dotted #7a7f9555',
                      }}
                    >
                      ↳ {ev.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
