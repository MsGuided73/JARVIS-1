// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import type { GraphNode } from '../hooks/useVaultGraph'

interface TooltipProps {
  node: GraphNode | null
  x: number
  y: number
}

export function Tooltip({ node, x, y }: TooltipProps) {
  if (!node) return null

  const OFFSET = 12
  const TOOLTIP_W = 240

  let left = x + OFFSET
  let top = y + OFFSET

  // Snap from right edge
  if (left + TOOLTIP_W > window.innerWidth - 20) {
    left = x - TOOLTIP_W - OFFSET
  }
  // Snap from bottom edge
  if (top > window.innerHeight - 100) {
    top = y - 80
  }

  return (
    <div style={{
      position: 'fixed',
      left,
      top,
      background: 'var(--panel-strong)',
      backdropFilter: 'var(--panel-blur)',
      WebkitBackdropFilter: 'var(--panel-blur)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      maxWidth: TOOLTIP_W,
      pointerEvents: 'none',
      zIndex: 100,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text)',
      boxShadow: '0 0 12px rgb(var(--accent-rgb) / 0.2)',
    }}>
      <div style={{ color: 'var(--accent)', marginBottom: 4, fontWeight: 'bold', fontSize: 13 }}>
        {node.label}
      </div>
      {node.excerpt && (
        <div style={{ opacity: 0.8, lineHeight: 1.5 }}>
          {node.excerpt}
        </div>
      )}
      {node.tags.length > 0 && (
        <div style={{ marginTop: 4, color: 'var(--success)', fontSize: 11 }}>
          {node.tags.slice(0, 4).map(t => `#${t}`).join(' ')}
        </div>
      )}
    </div>
  )
}
