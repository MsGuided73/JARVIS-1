# Output note: format, template, and sourcing checklist

Read this before writing any research note.

## Where to write

`<vault>/Research/People/<Person Name>.md`

- Create the `Research/People/` folder if it does not exist.
- Filename and `subject:` MUST match the canonical vault title in
  `<vault>/People/<Person Name>.md` exactly — the status scanner matches on it.
- One person per file. Never batch multiple people into one note.

## Frontmatter (required — this powers staleness detection)

```yaml
---
title: "<Name> — Where Are They Now"
subject: "<Name>"            # MUST equal the People/ note title
type: research
researched: <YYYY-MM-DD>     # today's date
source_article_count: <N>    # copy article_count from the live People/<Name>.md
source_last_mention: <date>  # copy last_mention from the live People/<Name>.md
confidence: high | medium | low
status: incarcerated | released | supervised | deceased | active | unknown
---
```

`source_article_count` and `source_last_mention` are the freshness baseline. A
later run flags this note **stale** when the live People note has gained
coverage (higher `article_count` or newer `last_mention`) since `researched`.

## Body structure

```markdown
> [!warning] AI-GENERATED — NOT FRANK REPORT REPORTING
> Compiled by Claude Code from independent public sources on <date>. Every claim
> links to its source. This is not primary Frank Report / Artvoice journalism and
> has not been verified by their team. Treat it as a research lead, not fact.

**Subject:** [[<Name>]]   ·   *<role / why they matter — one line>*

## Current status (as of <date>)

<2–5 sentences. Lead with the single most important current fact: in custody /
released / supervised / deceased / where / doing what. Every factual sentence
carries an inline [source](url). Lead with primary and independent sources.>

## Timeline since last Frank Report coverage

- **<date>** — <event> ([source](url))
- **<date>** — <event> ([source](url))

## Social presence

<Only VERIFIED, public, on-topic accounts — confirmed via cross-reference to a
known bio/affiliation, never "a profile with the same name." Link each and note
how it was verified. For private citizens / non-public figures (especially crime
victims), do NOT hunt personal accounts — write "not researched — privacy." For
the deceased/incarcerated, list only official memorial/legal pages if any. Omit
this section entirely when no verified account applies.>

- **<platform>** — [<handle>](url) — verified via <linkage>

## Sourcing notes

<Flag any conflict between independent sources and Frank Report / Artvoice
framing. State explicitly what could NOT be verified. If a claim rests only on
FR/Artvoice, say so.>

**Sources:** [<publisher — title>](url) · [<publisher — title>](url) · ...

---
*Generated <date> by the where-are-they-now skill. Re-run to refresh.*
```

## Sourcing checklist (well-grounded = non-negotiable)

- [ ] **Independent first.** Prioritize primary/independent sources: DOJ/USAO
      press releases, court dockets and opinions, BOP inmate locator, reputable
      mainstream press, Wikipedia for orientation only.
- [ ] **Every factual claim is inline-cited** at the sentence where it appears —
      not just dumped in a Sources list.
- [ ] **Recency.** Prefer the most recent reporting; date each event. The reader
      must know how current the status is.
- [ ] **Frank Report / Artvoice are the vault's own (aligned) reporting.** They
      may be cited, but never as the *sole* basis for a contested factual claim,
      and must be labeled as such.
- [ ] **Conflicts surfaced.** Where independent sources and FR/Artvoice diverge,
      say so plainly (see the Sandusky claim-check prototype for the pattern).
- [ ] **No fabrication.** If current status cannot be verified, set
      `status: unknown` / `confidence: low` and say what's missing. Never guess a
      prison, date, or outcome.
- [ ] **Right person.** Common names cause mix-ups — confirm identity via case
      details (which case, role) from the subject's People note before trusting a
      hit.
- [ ] **Social media — verified & on-topic only.** Check the major platforms (X,
      Facebook, Instagram, LinkedIn, YouTube, TikTok), but record ONLY accounts
      confirmed as the subject's via cross-reference to a known bio/affiliation —
      never a same-name profile. Respect privacy: for private citizens /
      non-public figures (especially crime victims) do not hunt personal
      accounts — note "not researched — privacy." Skip the deceased/incarcerated
      except official memorial/legal pages. Authenticated Firecrawl handles
      login-walled platforms better than WebFetch.

## Worked reference

The Phase-0 prototype `<vault>/Research/Where Are They Now (AI-researched).md`
shows the target tone and citation density (per-person sections, inline links,
**Sources:** line, warning callout). This skill supersedes that single file with
one note per person; once the principals in it are regenerated individually, the
legacy aggregate can be deleted.
