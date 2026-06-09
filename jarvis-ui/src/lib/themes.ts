// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

// Theme system. Each theme is a set of CSS custom-property values (applied to
// :root, consumed by the inline-styled components via var(--token)) plus a few
// values the 3D graph reads directly in JS (Three.js can't use CSS vars).

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  id: string
  name: string
  mode: ThemeMode
  // CSS variables (without the leading `--`).
  tokens: Record<string, string>
  // Consumed by Graph3D (WebGL) in JS:
  accent3d: number      // 0xRRGGBB — link highlights, selected bracket, labels, bloom tint
  canvasBg: string      // scene background hex
  nodeLightness: number // folder-hash node color lightness (lower = darker, for light bg)
}

export const THEMES: Theme[] = [
  {
    id: 'jarvis-cyan',
    name: 'Jarvis Cyan',
    mode: 'dark',
    accent3d: 0x00d4ff,
    canvasBg: '#000000',
    nodeLightness: 0.65,
    tokens: {
      'accent': '#00d4ff', 'accent-rgb': '0 212 255', 'accent-dim': '#00a8cc', 'accent-bright': '#00ccff',
      'surface': '#1e1e2e', 'surface-2': '#181825', 'surface-raised': '#2a2a3a',
      'border': '#313244', 'border-accent': '#1a3a4a',
      'panel': 'rgba(0,0,0,0.7)', 'panel-strong': 'rgba(10,11,18,0.92)',
      'text': '#cdd6f4', 'text-muted': '#a6adc8', 'text-faint': '#585b70',
      'success': '#a6e3a1', 'warn': '#f38ba8', 'purple': '#c4a7e7',
      'bg': '#000000',
    },
  },
  {
    id: 'iron-amber',
    name: 'Iron Amber',
    mode: 'dark',
    accent3d: 0xffb000,
    canvasBg: '#05040a',
    nodeLightness: 0.64,
    tokens: {
      'accent': '#ffb000', 'accent-rgb': '255 176 0', 'accent-dim': '#cc8a00', 'accent-bright': '#ffc94d',
      'surface': '#1c1a17', 'surface-2': '#15130f', 'surface-raised': '#2a2620',
      'border': '#3a342a', 'border-accent': '#4a3a1a',
      'panel': 'rgba(0,0,0,0.7)', 'panel-strong': 'rgba(18,15,10,0.92)',
      'text': '#f3e9d8', 'text-muted': '#c8b89a', 'text-faint': '#6b5f48',
      'success': '#a6e3a1', 'warn': '#f38ba8', 'purple': '#d9a066',
      'bg': '#000000',
    },
  },
  {
    id: 'matrix-green',
    name: 'Matrix Green',
    mode: 'dark',
    accent3d: 0x39ff14,
    canvasBg: '#000400',
    nodeLightness: 0.62,
    tokens: {
      'accent': '#39ff14', 'accent-rgb': '57 255 20', 'accent-dim': '#2bbf10', 'accent-bright': '#7dff5c',
      'surface': '#0d140d', 'surface-2': '#081008', 'surface-raised': '#142014',
      'border': '#1f3a1f', 'border-accent': '#1a4a1a',
      'panel': 'rgba(0,0,0,0.72)', 'panel-strong': 'rgba(4,12,4,0.93)',
      'text': '#c8f7c0', 'text-muted': '#8fbf88', 'text-faint': '#4a6a48',
      'success': '#a6e3a1', 'warn': '#f38ba8', 'purple': '#9ad06a',
      'bg': '#000000',
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    mode: 'dark',
    accent3d: 0xff2e97,
    canvasBg: '#0a0414',
    nodeLightness: 0.66,
    tokens: {
      'accent': '#ff2e97', 'accent-rgb': '255 46 151', 'accent-dim': '#cc2378', 'accent-bright': '#ff6ec7',
      'surface': '#1a1426', 'surface-2': '#120e1c', 'surface-raised': '#261a36',
      'border': '#3a2a4a', 'border-accent': '#4a1a3a',
      'panel': 'rgba(0,0,0,0.7)', 'panel-strong': 'rgba(14,8,22,0.92)',
      'text': '#f3d8ee', 'text-muted': '#c4a0c0', 'text-faint': '#6a5878',
      'success': '#a6e3a1', 'warn': '#f38ba8', 'purple': '#c4a7e7',
      'bg': '#05030a',
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    mode: 'light',
    accent3d: 0x0077cc,
    canvasBg: '#e9ecf2',
    nodeLightness: 0.45,
    tokens: {
      'accent': '#0077cc', 'accent-rgb': '0 119 204', 'accent-dim': '#005fa3', 'accent-bright': '#2a93e0',
      'surface': '#ffffff', 'surface-2': '#f0f2f6', 'surface-raised': '#e6e9ef',
      'border': '#d4d9e2', 'border-accent': '#b8d4ea',
      'panel': 'rgba(255,255,255,0.85)', 'panel-strong': 'rgba(248,250,253,0.96)',
      'text': '#1b1f2a', 'text-muted': '#5a6473', 'text-faint': '#8a93a3',
      'success': '#2e9e5b', 'warn': '#d4456a', 'purple': '#7c5cbf',
      'bg': '#e9ecf2',
    },
  },
]

const STORAGE_KEY = 'jarvis-theme'
const DEFAULT_ID = 'jarvis-cyan'

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export function getInitialThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && THEMES.some(t => t.id === saved)) return saved
  } catch { /* storage unavailable */ }
  return DEFAULT_ID
}

// Apply a theme's CSS variables to :root and persist the choice.
export function applyTheme(id: string): Theme {
  const theme = getTheme(id)
  const root = document.documentElement
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${name}`, value)
  }
  root.style.colorScheme = theme.mode
  root.setAttribute('data-theme', theme.id)
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* storage unavailable */ }
  return theme
}
