// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useState, useRef } from 'react'
import { PresetManager } from './PresetManager'
import type { Preset } from '../hooks/usePresets'
import { THEMES } from '../lib/themes'

interface SettingsProps {
  themeId: string
  onThemeChange: (id: string) => void
  bloomStrength: number
  nodeOpacity: number
  starsEnabled: boolean
  labelsEnabled: boolean
  linksEnabled: boolean
  linkOpacity: number
  spread: number
  minNodeSize: number
  maxNodeSize: number
  ultraNodeSize: number
  onBloomStrengthChange: (value: number) => void
  onOpacityChange: (value: number) => void
  onStarsToggle: (enabled: boolean) => void
  onLabelsToggle: (enabled: boolean) => void
  onLinksToggle: (enabled: boolean) => void
  onLinkOpacityChange: (value: number) => void
  onSpreadChange: (value: number) => void
  onMinSizeChange: (value: number) => void
  onMaxSizeChange: (value: number) => void
  onUltraNodeSizeChange: (value: number) => void
  onResetAll: () => void
  onResetPosition: () => void
  onChangeVault: () => void
  zoomToNode: boolean
  onZoomToNodeToggle: (v: boolean) => void
  isolateOnSelect: boolean
  onIsolateToggle: (v: boolean) => void
  graphShape: 'sun' | 'saturn' | 'milkyway' | 'brain' | 'natural' | 'tagboxes'
  onGraphShapeChange: (v: 'sun' | 'saturn' | 'milkyway' | 'brain' | 'natural' | 'tagboxes') => void
  textSize: number
  onTextSizeChange: (v: number) => void
  tagBoxTopN: number
  onTagBoxTopNChange: (v: number) => void
  tagBoxSizeScale: number
  onTagBoxSizeScaleChange: (v: number) => void
  presets: Preset[]
  onPresetSave: (name: string) => void
  onPresetLoad: (id: string) => void
  onPresetDelete: (id: string) => void
}

export function Settings({
  themeId,
  onThemeChange,
  bloomStrength,
  nodeOpacity,
  starsEnabled,
  labelsEnabled,
  linksEnabled,
  linkOpacity,
  spread,
  minNodeSize,
  maxNodeSize,
  ultraNodeSize,
  onBloomStrengthChange,
  onOpacityChange,
  onStarsToggle,
  onLabelsToggle,
  onLinksToggle,
  onLinkOpacityChange,
  onSpreadChange,
  onMinSizeChange,
  onMaxSizeChange,
  onUltraNodeSizeChange,
  onResetAll,
  onResetPosition,
  onChangeVault,
  zoomToNode,
  onZoomToNodeToggle,
  isolateOnSelect,
  onIsolateToggle,
  graphShape,
  onGraphShapeChange,
  textSize,
  onTextSizeChange,
  tagBoxTopN,
  onTagBoxTopNChange,
  tagBoxSizeScale,
  onTagBoxSizeScaleChange,
  presets,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
}: SettingsProps) {
  const prevBloom = useRef(bloomStrength > 0 ? bloomStrength : 1.5)
  const [hoveredShape, setHoveredShape] = useState<string | null>(null)
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-settings-open') !== 'false' } catch { return true }
  })
  const toggleOpen = (v: boolean) => {
    setOpen(v)
    try { localStorage.setItem('jarvis-settings-open', String(v)) } catch { // storage unavailable
    }
  }

  const toggleBtn = (active: boolean, label: string, onClick: () => void, tooltip?: string) => (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        background: active ? 'rgb(var(--accent-rgb) / 0.13)' : 'rgba(0,0,0,0.5)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-accent)'}`,
        color: active ? 'var(--accent)' : 'var(--text-faint)',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 12px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        letterSpacing: '0.08em',
        width: '100%',
      }}
    >{label}</button>
  )

  const sliderRow = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, tooltip?: string) => (
    <div style={{ marginBottom: 14 }} title={tooltip}>
      <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>
        {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
    </div>
  )

  return (
    <div style={{
      position: 'fixed',
      top: 134,
      left: 16,
      zIndex: 150,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    }}>
      <button
        onClick={() => toggleOpen(!open)}
        title="Settings"
        style={{
          background: open ? 'rgb(var(--accent-rgb) / 0.13)' : 'var(--panel)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-accent)'}`,
          color: open ? 'var(--accent)' : 'var(--accent-dim)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >⚙</button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: 8,
          background: 'var(--panel-strong)',
          backdropFilter: 'var(--panel-blur)',
          WebkitBackdropFilter: 'var(--panel-blur)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          width: 224,
          boxShadow: '0 0 15px rgb(var(--accent-rgb) / 0.13)',
          color: 'var(--accent-dim)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}>
          <div style={{ marginBottom: 14 }} title="Switch the overall look of Jarvis.">
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>THEME</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {THEMES.map(t => {
                const active = t.id === themeId
                return (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id)}
                    title={`${t.name} (${t.mode})`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                      background: active ? 'rgb(var(--accent-rgb) / 0.13)' : 'rgba(0,0,0,0.25)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 10,
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: t.tokens.accent, border: '1px solid rgba(128,128,128,0.4)',
                    }} />
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }} title="Glow/bloom intensity around nodes (the cyberpunk halo). Click the label to toggle off.">
            <div
              onClick={() => onBloomStrengthChange(bloomStrength > 0 ? 0 : (prevBloom.current || 1.5))}
              style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
            >
              BLOOM: {bloomStrength > 0 ? bloomStrength.toFixed(1) : 'OFF'}
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={bloomStrength}
              onChange={e => {
                const v = Number(e.target.value)
                if (v > 0) prevBloom.current = v
                onBloomStrengthChange(v)
              }}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>STARS</div>
            {toggleBtn(starsEnabled, `[ STARS ${starsEnabled ? 'ON' : 'OFF'} ]`, () => onStarsToggle(!starsEnabled), 'Toggle the background star field and galaxy backdrops.')}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>LABELS</div>
            {toggleBtn(labelsEnabled, `[ LABELS ${labelsEnabled ? 'ON' : 'OFF'} ]`, () => onLabelsToggle(!labelsEnabled), 'Show or hide the text label on each node.')}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>LINKS</div>
            {toggleBtn(linksEnabled, `[ LINKS ${linksEnabled ? 'ON' : 'OFF'} ]`, () => onLinksToggle(!linksEnabled), 'Show or hide the connection lines between nodes.')}
          </div>

          {linksEnabled && sliderRow(
            `LINK BRIGHTNESS: ${linkOpacity.toFixed(2)}`,
            linkOpacity, 0, 1, 0.02, onLinkOpacityChange,
            'Brightness of the background connection lines. Lower this if the links wash out the nodes — the bright cyan links for a selected node are unaffected.',
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>ZOOM TO NODE</div>
            {toggleBtn(zoomToNode, `[ ZOOM TO NODE ${zoomToNode ? 'ON' : 'OFF'} ]`, () => onZoomToNodeToggle(!zoomToNode), 'When ON, the camera flies to a node when you click it.')}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>ISOLATE ON SELECT</div>
            {toggleBtn(isolateOnSelect, `[ ISOLATE ${isolateOnSelect ? 'ON' : 'OFF'} ]`, () => onIsolateToggle(!isolateOnSelect), 'When ON, selecting a node hides everything except it and its directly-connected neighbours. Press ESC to clear.')}
          </div>

          {sliderRow(`OPACITY: ${nodeOpacity.toFixed(2)}`, nodeOpacity, 0.1, 1.0, 0.05, onOpacityChange, 'Transparency of the nodes (lower = more see-through).')}
          {sliderRow(`SPREAD: ${spread.toFixed(1)}x`, spread, 1.0, 10.0, 0.1, onSpreadChange, 'How far apart nodes are spaced in the layout.')}
          {sliderRow(`TEXT SIZE: ${textSize.toFixed(1)}x`, textSize, 1.0, 10.0, 0.5, onTextSizeChange, 'Size of the node text labels.')}
          {graphShape === 'tagboxes' && sliderRow(`TOP TAGS: ${tagBoxTopN}`, tagBoxTopN, 1, 48, 1, (v) => onTagBoxTopNChange(v), 'How many of the most common tags to show as boxes.')}
          {graphShape === 'tagboxes' && sliderRow(`BOX SIZE: ${tagBoxSizeScale.toFixed(1)}x`, tagBoxSizeScale, 0.5, 3.0, 0.1, (v) => onTagBoxSizeScaleChange(v), 'Scale of the tag boxes.')}
          {sliderRow(`NODE SIZE: ${minNodeSize.toFixed(1)}x`, minNodeSize, 1.0, 2.0, 0.1, onMinSizeChange, 'Base size of regular nodes.')}

          <div style={{ marginBottom: 14 }} title="Size of supernodes — the top 15% most-connected nodes (major hubs).">
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>
              SUPERNODE SIZE: {maxNodeSize.toFixed(1)}x
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={maxNodeSize}
              onChange={e => onMaxSizeChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: 14 }} title="Size of ultranodes — the top 2% hub-of-hubs (e.g. Frank Parlato, NXIVM).">
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>
              ULTRANODE SIZE: {ultraNodeSize.toFixed(1)}x
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={ultraNodeSize}
              onChange={e => onUltraNodeSizeChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: 14 }} title="Graph layout shape — how nodes are arranged in 3D space.">
            <div style={{ marginBottom: 6, letterSpacing: '0.08em', fontSize: 10, color: 'var(--text-muted)' }}>SHAPE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {([
                { value: 'natural', icon: '🌿', label: 'Natural' },
                { value: 'sun', icon: '☀️', label: 'The Sun' },

                { value: 'saturn', icon: '🪐', label: 'Saturn' },
                { value: 'milkyway', icon: '🌌', label: 'Milky Way' },
                { value: 'brain', icon: '🧠', label: 'Brain' },
                { value: 'tagboxes', icon: '🗃️', label: 'Tag Boxes' },
              ] as const).map(({ value, icon, label }) => {
                const isSelected = graphShape === value
                const isHovered = hoveredShape === value
                return (
                  <button
                    key={value}
                    onClick={() => onGraphShapeChange(value)}
                    onMouseEnter={() => setHoveredShape(value)}
                    onMouseLeave={() => setHoveredShape(null)}
                    title={label}
                    style={{
                      background: isSelected ? 'rgb(var(--accent-rgb) / 0.13)' : isHovered ? 'rgb(var(--accent-rgb) / 0.05)' : 'rgba(0,0,0,0.5)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : isHovered ? 'rgb(var(--accent-rgb) / 0.4)' : 'var(--border-accent)'}`,
                      color: isSelected ? 'var(--accent)' : isHovered ? 'var(--accent-dim)' : 'var(--text-faint)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 4px 8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 10,
                      letterSpacing: '0.05em',
                      textAlign: 'center',
                      boxShadow: isSelected ? '0 0 8px rgb(var(--accent-rgb) / 0.27)' : 'none',
                      transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{icon}</span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <PresetManager
            presets={presets}
            onSave={onPresetSave}
            onLoad={onPresetLoad}
            onDelete={onPresetDelete}
          />

          <div style={{ borderTop: '1px solid var(--border-accent)', paddingTop: 14, marginBottom: 0 }}>
            {toggleBtn(false, '[ RESET ALL ]', onResetAll, 'Reset camera, filters, sliders, and simulation to defaults.')}
            <div style={{ marginTop: 8 }}>
              {toggleBtn(false, '[ Reset View ]', onResetPosition, 'Snap the camera back to fit all nodes in view.')}
            </div>
            <div style={{ marginTop: 8 }}>
              {toggleBtn(false, '⚙ Change Vault', onChangeVault, 'Point Jarvis at a different vault folder.')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
