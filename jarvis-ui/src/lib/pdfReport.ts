// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Prompt-Surfer (https://github.com/Prompt-Surfer)

// Browser print → PDF report generation. Builds a clean, light-themed report
// document in a new tab and opens the print dialog (→ Save as PDF). Vector text,
// native pagination, zero extra dependencies.

import { escapeHtml, markdownToHtml } from './markdownToHtml'

export interface ReportEvent {
  date: string
  display: string
  precision?: 'day' | 'month'
  description: string
  source?: string
  note?: string
}

export interface CaseReport {
  name: string
  span: string
  articleCount: number
  events: ReportEvent[]
}

const PRINT_CSS = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    color: #1b1b1f; line-height: 1.55; max-width: 720px;
    margin: 0 auto; padding: 28px;
  }
  .report-head { border-bottom: 2px solid #0b6b8c; padding-bottom: 12px; margin-bottom: 22px; }
  .report-head h1 {
    font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 26px;
    letter-spacing: -0.01em; margin: 0 0 4px;
  }
  .report-meta { font-family: 'SFMono-Regular', 'Courier New', monospace; font-size: 12px; color: #5a6470; }
  h2 {
    font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #0b6b8c;
    border-bottom: 1px solid #d8dde3; padding-bottom: 4px; margin: 28px 0 12px;
  }
  h3 { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; margin: 18px 0 6px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #cfe4ec; margin: 10px 0; padding: 2px 0 2px 14px; color: #44505c; font-style: italic; }
  hr { border: none; border-top: 1px solid #e2e6ea; margin: 18px 0; }
  a { color: #0b6b8c; }
  .tl-event { padding: 0 0 12px 16px; border-left: 2px solid #cfe4ec; margin-left: 4px; page-break-inside: avoid; }
  .tl-date { font-family: 'SFMono-Regular', 'Courier New', monospace; font-size: 12px; color: #0b6b8c; font-weight: 700; }
  .tl-desc { font-size: 14px; margin: 2px 0; }
  .tl-src { font-size: 11px; color: #7a818c; font-style: italic; }
  .case-block { page-break-inside: avoid; margin-bottom: 8px; }
  .report-foot {
    margin-top: 34px; padding-top: 10px; border-top: 1px solid #d8dde3;
    font-size: 11px; color: #8a929c; font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  @media print { body { padding: 0; } a { text-decoration: none; color: #1b1b1f; } }
`

// Open a print-ready report in a new tab and trigger the print dialog.
function openPrintReport(title: string, bodyHtml: string): void {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Could not open the PDF report — please allow pop-ups for this site, then try again.')
    return
  }
  // The inline onload script prints once layout/fonts settle.
  const printScript = '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</scr' + 'ipt>'
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}${printScript}</body></html>`
  w.document.open()
  w.document.write(doc)
  w.document.close()
}

function generatedLine(): string {
  // Client-side Date is fine here (not a workflow script).
  return `Frank Report Vault — generated ${new Date().toLocaleString()}`
}

function shell(title: string, subtitle: string, sections: string): string {
  return `<div class="report-head"><h1>${escapeHtml(title)}</h1><div class="report-meta">${escapeHtml(subtitle)}</div></div>${sections}<div class="report-foot">${escapeHtml(generatedLine())}</div>`
}

function eventsHtml(events: ReportEvent[]): string {
  return events.map((e) => {
    const src = e.source ?? e.note
    return `<div class="tl-event"><div class="tl-date">${escapeHtml(e.display)}</div><div class="tl-desc">${escapeHtml(e.description)}</div>${src ? `<div class="tl-src">↳ ${escapeHtml(src)}</div>` : ''}</div>`
  }).join('')
}

// ── Public report builders ────────────────────────────────────────────────────

// A single case's full chronological timeline.
export function printCaseTimeline(c: CaseReport): void {
  const title = `${c.name} — Case Timeline`
  const subtitle = `Case timeline · ${c.span} · ${c.articleCount} articles · ${c.events.length} dated events`
  const body = `<h2>Timeline of events</h2>${c.events.length ? eventsHtml(c.events) : '<p>No dated events.</p>'}`
  openPrintReport(title, shell(title, subtitle, body))
}

// Overview of every case (dashboard) with a short event preview each.
export function printCaseOverview(cases: CaseReport[], previewPerCase = 6): void {
  const title = 'Frank Report — Case Overview'
  const subtitle = `${cases.length} cases · ${cases.reduce((n, c) => n + c.events.length, 0)} dated events total`
  const body = cases.map((c) => {
    const more = c.events.length > previewPerCase ? `<div class="tl-src">…and ${c.events.length - previewPerCase} more events</div>` : ''
    return `<div class="case-block"><h2>${escapeHtml(c.name)}</h2><div class="report-meta">${escapeHtml(`${c.span} · ${c.articleCount} articles · ${c.events.length} dated events`)}</div></div>${eventsHtml(c.events.slice(0, previewPerCase))}${more}`
  }).join('')
  openPrintReport(title, shell(title, subtitle, body))
}

// A single node: its relevant timeline plus the note summary/body.
export function printNodeReport(opts: {
  title: string
  subtitle: string
  events: ReportEvent[]
  markdown?: string | null
}): void {
  const tl = opts.events.length ? `<h2>Timeline (${opts.events.length})</h2>${eventsHtml(opts.events)}` : ''
  const summary = opts.markdown ? `<h2>Summary</h2>${markdownToHtml(opts.markdown)}` : ''
  const body = tl + summary || '<p>No content available for this node.</p>'
  openPrintReport(opts.title, shell(opts.title, opts.subtitle, body))
}
