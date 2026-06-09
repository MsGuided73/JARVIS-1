// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

import { useEffect, useRef, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Extension } from '@codemirror/state'

interface NoteEditorProps {
  content: string
  notePath: string
  onSaveStatus: (status: 'saving' | 'saved' | null) => void
}

const jarvisDark: Extension = EditorView.theme({
  '&': { background: 'var(--surface)', color: 'var(--text)', height: '100%' },
  '.cm-editor': { height: '100%' },
  '.cm-scroller': { fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: '14px', lineHeight: '1.7' },
  '.cm-focused': { outline: 'none' },
  '.cm-gutters': { background: 'var(--surface-2)', color: 'var(--text-muted)', border: 'none' },
  '.cm-activeLineGutter': { background: 'var(--surface)' },
  '.cm-activeLine': { background: 'color-mix(in srgb, var(--surface) 13%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground': { background: 'rgb(var(--accent-rgb) / 0.13) !important' },
  '.cm-line': { paddingLeft: '8px' },
}, { dark: true })

export function NoteEditor({ content, notePath, onSaveStatus }: NoteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveContent = useCallback(async (text: string) => {
    onSaveStatus('saving')
    try {
      await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: notePath, content: text }),
      })
      onSaveStatus('saved')
      setTimeout(() => onSaveStatus(null), 2000)
    } catch {
      onSaveStatus(null)
    }
  }, [notePath, onSaveStatus])

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        jarvisDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString()
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => saveContent(text), 2000)
          }
        }),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      view.destroy()
      viewRef.current = null
    }
  }, [content, notePath, saveContent])

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'auto' }}
    />
  )
}
