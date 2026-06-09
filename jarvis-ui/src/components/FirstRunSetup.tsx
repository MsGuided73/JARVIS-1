// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useState, useEffect } from 'react'

interface ConfigResponse {
  configured: boolean
  vaultPath: string | null
  platform: string
  suggestedPaths: string[]
}

interface ValidationResult {
  valid: boolean
  noteCount: number
  error?: string
}

interface FirstRunSetupProps {
  onConfigured: () => void
}

const OS_ICONS: Record<string, string> = {
  win32: '🪟',
  darwin: '🍎',
  linux: '🐧',
}

const OS_LABELS: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
}

const PATH_HINTS: Record<string, string> = {
  win32: 'e.g. C:\\Users\\YourName\\Documents\\Obsidian',
  darwin: 'e.g. /Users/YourName/Documents/Obsidian',
  linux: 'e.g. /home/yourname/obsidian',
}

export function FirstRunSetup({ onConfigured }: FirstRunSetupProps) {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [inputPath, setInputPath] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((d: ConfigResponse) => setConfig(d))
      .catch(() => {})
  }, [])

  const handleValidate = async () => {
    if (!inputPath.trim()) return
    setValidating(true)
    setValidation(null)
    setSaveError(null)
    try {
      const r = await fetch(`/api/config/validate?path=${encodeURIComponent(inputPath.trim())}`)
      const d = await r.json() as ValidationResult
      setValidation(d)
    } catch {
      setValidation({ valid: false, noteCount: 0, error: 'Could not reach server' })
    } finally {
      setValidating(false)
    }
  }

  const handleConfirm = async () => {
    if (!validation?.valid) return
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultPath: inputPath.trim() }),
      })
      if (r.ok) {
        onConfigured()
      } else {
        const d = await r.json() as { error?: string }
        setSaveError(d.error ?? 'Failed to save config')
      }
    } catch {
      setSaveError('Could not reach server')
    } finally {
      setSaving(false)
    }
  }

  const handleChipClick = (p: string) => {
    setInputPath(p)
    setValidation(null)
    setSaveError(null)
  }

  const handleInputChange = (v: string) => {
    setInputPath(v)
    setValidation(null)
    setSaveError(null)
  }

  const platform = config?.platform ?? 'linux'
  const osIcon = OS_ICONS[platform] ?? '💻'
  const osLabel = OS_LABELS[platform] ?? platform
  const pathHint = PATH_HINTS[platform] ?? ''
  const isValidated = validation?.valid === true
  const inputBorderColor = validation
    ? (validation.valid ? 'var(--success)' : 'var(--warn)')
    : 'var(--border)'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--panel-strong)',
      backdropFilter: 'var(--panel-blur)',
      WebkitBackdropFilter: 'var(--panel-blur)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{
        background: '#11111b',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 32,
        maxWidth: 520,
        width: '100%',
        margin: '0 16px',
        boxShadow: '0 0 40px rgba(0,212,255,0.12)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.2em',
            marginBottom: 6,
          }}>
            JARVIS
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
          }}>
            OBSIDIAN VAULT SETUP
          </div>
        </div>

        {/* OS Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
          marginBottom: 20,
          fontSize: 11,
          color: 'var(--text)',
        }}>
          <span>{osIcon}</span>
          <span>{osLabel} detected</span>
        </div>

        {/* Suggested paths */}
        {config?.suggestedPaths && config.suggestedPaths.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              SUGGESTED PATHS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {config.suggestedPaths.map(p => (
                <button
                  key={p}
                  onClick={() => handleChipClick(p)}
                  style={{
                    background: inputPath === p ? 'rgb(var(--accent-rgb) / 0.13)' : 'var(--surface)',
                    border: `1px solid ${inputPath === p ? 'var(--accent)' : 'var(--border)'}`,
                    color: inputPath === p ? 'var(--accent)' : '#7f849c',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 10,
                    letterSpacing: '0.03em',
                    transition: 'border-color 0.12s, color 0.12s',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Path input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}>
            VAULT PATH
          </div>
          <input
            type="text"
            value={inputPath}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleValidate() }}
            placeholder="Paste vault path or select a suggestion"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: `1px solid ${inputBorderColor}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: '10px 12px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
          {pathHint && (
            <div style={{ marginTop: 5, fontSize: 10, color: 'var(--border)' }}>
              {pathHint}
            </div>
          )}
        </div>

        {/* Validation feedback */}
        {validation && (
          <div style={{
            marginBottom: 14,
            fontSize: 11,
            color: validation.valid ? 'var(--success)' : 'var(--warn)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>{validation.valid ? '✓' : '✗'}</span>
            <span>
              {validation.valid
                ? `Found ${validation.noteCount} notes`
                : (validation.error ?? 'Validation failed')}
            </span>
          </div>
        )}

        {saveError && (
          <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--warn)' }}>
            ✗ {saveError}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleValidate}
            disabled={validating || !inputPath.trim()}
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border)',
              color: inputPath.trim() ? 'var(--accent-dim)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 0',
              cursor: inputPath.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: '0.08em',
            }}
          >
            {validating ? '◌ CHECKING...' : '[ VALIDATE ]'}
          </button>

          <button
            onClick={handleConfirm}
            disabled={!isValidated || saving}
            style={{
              flex: 1,
              background: isValidated ? 'rgb(var(--accent-rgb) / 0.13)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${isValidated ? 'var(--accent)' : 'var(--border)'}`,
              color: isValidated ? 'var(--accent)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 0',
              cursor: isValidated ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: '0.08em',
              boxShadow: isValidated ? '0 0 10px rgb(var(--accent-rgb) / 0.2)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {saving ? '◌ SAVING...' : '[ CONFIRM ]'}
          </button>
        </div>
      </div>
    </div>
  )
}
