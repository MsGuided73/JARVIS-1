// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useEffect, useRef, useState } from 'react'

interface SemanticStatus {
  ready: boolean
  indexed: number
  total: number
  model: string
}

interface HUDProps {
  nodeCount: number
  linkCount: number
  visibleNodeCount: number
  simDone: boolean
  breadcrumb?: string | null
  timelapsePlaying?: boolean
  timelapseDate?: number
  onPauseTimelapse?: () => void
  semanticStatus?: SemanticStatus | null
}

export function HUD({ nodeCount, linkCount, visibleNodeCount, simDone, breadcrumb, timelapsePlaying, timelapseDate, onPauseTimelapse, semanticStatus }: HUDProps) {
  const [fps, setFps] = useState(0)
  const frameTimesRef = useRef<number[]>([])
  const lastFrameRef = useRef(performance.now())

  useEffect(() => {
    let rafId: number
    function tick() {
      const now = performance.now()
      const delta = now - lastFrameRef.current
      lastFrameRef.current = now

      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) frameTimesRef.current.shift()

      const avg = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      setFps(Math.round(1000 / avg))

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--accent-dim)',
      lineHeight: '1.7',
      userSelect: 'none',
      textShadow: '0 0 8px color-mix(in srgb, var(--accent-dim) 27%, transparent)',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto', width: 'fit-content' }}>
        <div title="Total number of nodes (articles + categories + entities) in the graph.">NODES: {nodeCount}</div>
        <div title="Nodes currently shown after any search, tag, time, or focus filters.">VISIBLE: {visibleNodeCount}</div>
        <div title="Total number of links (connections) between nodes.">LINKS: {linkCount}</div>
        <div title="Rendering frame rate (frames per second).">FPS: {fps}</div>
        <div
          title={simDone ? 'The force-directed layout has settled into place.' : 'The layout physics is still arranging the nodes.'}
          style={{ marginTop: 4, color: simDone ? 'var(--accent)' : '#ff6b35' }}
        >
          {simDone ? '■ SIM STABLE' : '◌ SIMULATING'}
        </div>
      </div>
      {breadcrumb && (
        <div style={{ marginTop: 4, color: 'var(--accent)', fontSize: 10, letterSpacing: '0.06em' }}>
          {breadcrumb}
        </div>
      )}
      {semanticStatus && !semanticStatus.ready && semanticStatus.total > 0 && (
        <div style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          color: 'var(--purple)',
          fontSize: 11,
          letterSpacing: '0.08em',
        }}>
          INDEXING: {semanticStatus.indexed}/{semanticStatus.total}
        </div>
      )}
      {timelapsePlaying && (
        <div
          onClick={onPauseTimelapse}
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgb(var(--accent-rgb) / 0.07)',
            border: '1px solid rgb(var(--accent-rgb) / 0.27)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 8px',
            color: 'var(--accent)',
            fontSize: 11,
            letterSpacing: '0.08em',
            animation: 'timelapse-pulse 1.5s ease-in-out infinite',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
          title="Click to pause timelapse"
        >
          <span>▶ TIMELAPSE</span>
          {timelapseDate !== undefined && (
            <span style={{ color: 'rgb(var(--accent-rgb) / 0.67)', fontSize: 10 }}>{fmtDate(timelapseDate)}</span>
          )}
        </div>
      )}
    </div>
  )
}
