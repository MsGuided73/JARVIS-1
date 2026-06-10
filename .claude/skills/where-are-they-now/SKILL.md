---
name: where-are-they-now
description: >-
  Research the current status ("where are they now") of people in a Frank
  Report-style Obsidian knowledge vault. Scans which People notes already have a
  research note, flags stale ones, and researches the next batch using
  independent, well-grounded web research — writing one fully-cited note per
  person under Research/People/. Use when the user asks to run or continue the
  "Where Are They Now" analysis, update someone's current status, or work
  through the vault's people. Triggers: "where are they now", "update
  status of", "who is X now", "continue the WATN analysis".
---

# Where Are They Now

Compile grounded, independently-sourced "current status" notes for the people in
a Frank Report-style vault (NXIVM, OneTaste, Sandusky and related figures),
working through the dataset a batch at a time and tracking what's already done.

The "AI" is **you** (Claude Code) driving `WebSearch` + `WebFetch`. The host app
has no LLM/search integration, so all research happens here.

## Vault location

The skill is vault-agnostic. The scanner resolves the vault in this order:
`--vault <path>` → `$JARVIS_VAULT_PATH` → `./vault` (if cwd has a `People/`
folder) → `~/.jarvis-config.json` (`vaultPath`). For the Frank Report project
this resolves to its `vault/`. If resolution fails, ask the user for the path.

## Workflow

### 1. Scan coverage (always first)

Run the read-only scanner from this skill's directory:

```bash
node "<skill-dir>/scripts/status.mjs" --json
```

It returns vault path, totals (`fresh` / `stale` / `never`), the recommended
`next` subjects (ranked by article coverage, never-researched first), and the
`stale` list. Report the totals to the user in one line so they see progress
(e.g. "12 fresh · 3 stale · 278 to go").

### 2. Choose subjects

- **If the user named people** (as args or in the request) → research exactly
  those. Map each to its canonical `People/<Name>.md` title (check `aliases`).
- **Otherwise** → use `AskUserQuestion` to offer the two paths the user wants:
  1. **Take the next 5** — the scanner's `next` list, shown with article counts.
  2. **Provide names** — let them type specific subjects (free-text "Other").
  Include any **stale** subjects as a third option when the `stale` list is
  non-empty ("Refresh N stale notes"). Do not research blind — always confirm.

### 3. Gather context (per subject, before searching)

Read `<vault>/People/<Name>.md`. Capture: `aliases`, `cases`, `article_count`,
`last_mention`, and the Articles list (what Frank Report has already claimed and
when). This anchors identity (avoid same-name mix-ups) and tells you what
"since last coverage" means.

### 4. Research — independent and well-grounded

Use `WebSearch` then `WebFetch` on the strongest hits. Follow the **sourcing
checklist in `references/template.md`** (read it). In short:
- Independent / primary sources first: DOJ & USAO releases, court dockets and
  opinions, BOP inmate locator, reputable mainstream press; Wikipedia only to
  orient. Run a couple of recency-focused queries — get the *latest* status.
- Frank Report / Artvoice are the vault's own aligned reporting — may be cited,
  never the sole basis for a contested claim, always labeled as such.
- Surface conflicts between independent sources and FR/Artvoice framing.
- If status can't be verified, mark `status: unknown` / `confidence: low` and
  say what's missing. Never invent a prison, date, or outcome.

### 5. Write one note per person

Read `references/template.md` and follow it exactly. Write to
`<vault>/Research/People/<Name>.md` (create the folder if needed). The
frontmatter MUST copy `source_article_count` and `source_last_mention` from the
live People note and set `subject:` to the exact People title — this is what
makes the note detectable and staleness-checkable on the next run. Include
`**Subject:** [[<Name>]]` in the body so the graph links research → person.

### 6. Report back

Summarize what was written and re-state remaining coverage (re-run the scanner
or subtract). Offer to continue with the next batch.

## Notes

- **Idempotent / resumable.** Re-running never duplicates work: the scanner sees
  existing notes and moves on. "Stale" notes (subject gained new articles or the
  note aged past the staleness window, default 120d) are surfaced for refresh —
  refreshing means regenerating the note with today's date and current counts.
- **Status-only check.** To just see coverage without researching, run the
  scanner without `--json` and relay the table. Useful to answer "have we done
  X yet?" / "who's left?".
- **Legacy prototype.** `<vault>/Research/Where Are They Now (AI-researched).md`
  is the Phase-0 single-file prototype. This skill supersedes it with per-person
  notes; once its principals (Raniere, Mack, C. Bronfman, Salzman, Daedone,
  Cherwitz) are regenerated individually, that file can be deleted.
- **Scope.** People (`type:person`) by default. Orgs/programs (NXIVM, OneTaste,
  DOS) are out of scope unless the user explicitly asks.
