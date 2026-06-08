# Frank Report Vault

Builds an Obsidian vault from **FrankReport.com** articles (Frank Parlato's
investigative journalism) and views it as an interactive 3D knowledge graph via
the bundled **Jarvis UI**.

FrankReport.com runs on **Payload CMS** (Next.js / Vercel). Articles are pulled
from its open REST API (`/api/posts`) — no HTML scraping — and converted to
linked Markdown notes. Sister site `artvoice.com` shares article slugs and its
in-body links are resolved as internal wikilinks.

The Payload backend is **multi-tenant** (Frank Report + Artvoice + others share
one API; 12,341 posts total). Ingestion filters to `site=frankreport` by default,
so only the **~7,445 articles published on frankreport.com** are included. Set
`FR_SITE=all` to ingest every tenant.

## Layout

```
frank_report/
  scripts/
    ingest.mjs         Pull articles from the Payload API -> data/raw/posts.json
    lexical-to-md.mjs  Convert Payload Lexical rich-text JSON -> Markdown
    entities.mjs       Entity extraction (gazetteer + Title-Case proper nouns)
    canonical.mjs      Alias merge, typing, and parent->child containment
    build-vault.mjs    Assemble the Obsidian vault
  data/raw/            Cached raw API JSON (never re-fetched unless deleted)
  vault/               The Obsidian vault (see folders below)
  jarvis-ui/           3D graph viewer (fork of Prompt-Surfer/obsidian-jarvis-ui; see patch note)
```

### Vault folders (each is a distinct color in Jarvis)

```
Articles/      one note per article (full body + link sections)
Categories/    Payload categories
Authors/       bylines (Frank Parlato, Troy Smith, ...)
People/        person entities (+ Family hubs: Bronfman, Salzman)
Judges/  Legal/  Government/  Organizations/  Places/  Programs/   typed entities
```

### Entity model (`canonical.mjs`)

Raw extracted entities are consolidated before they become notes:
- **Alias merge** — possessives (`Sandusky's`→`Sandusky`), titles (`President Trump`→
  `Donald Trump`), and surname/middle-name variants (`Raniere`, `Keith Alan Raniere`
  → `Keith Raniere`) collapse into one node.
- **Typing** — each entity is classified (Person / Judge / Org / Government / Legal /
  Place / Program / Family) and written to the matching top-level folder so Jarvis
  color-codes by type.
- **Containment** — `**Part of:**` / `**Includes:**` links model hierarchy:
  `DOS`,`ESP`,`Jness` → `NXIVM`; `Clare Bronfman`,`Sara Bronfman` → `Bronfman`;
  `X County DA` → `X County`. Curated map in `canonical.mjs` (`CONTAINMENT`).

### Jarvis patch (Windows)

Local changes to the upstream fork:
- `server/graph-worker.ts` — normalize `\` → `/` in relative paths. Without it,
  `getTopFolder` returns `''` on Windows and **all nodes render the same color**.
- `components/Settings.tsx`, `HUD.tsx` + 6 others — brightened the muted "inactive"
  text (`#585b70` → `#a6adc8`) for readability, and added hover tooltips (`title`)
  to the settings controls and HUD stat readouts.

## Current state (POC)

- **300 newest articles** ingested and built.
- Graph: ~500 nodes (293 articles, 165 entities, 36 categories, 5 authors), ~2,250 links, 0 orphans.

## Commands

```bash
# 1. Ingest (POC: 300 newest frankreport.com posts). For the FULL frankreport
#    archive (~7,445 posts): set FR_TARGET=all  — ~75 API calls.
#    FR_SITE=all adds Artvoice/other tenants (~12,341 total).
npm run ingest                      # or: FR_TARGET=all npm run ingest

# 2. Build the vault from cached JSON
npm run build

# 3. View in 3D
cd jarvis-ui && npm run dev          # http://localhost:5173  (API on :3001)
```

`npm run all` = ingest + build.

## How the graph is wired

Each article note links to:
- its **Categories** (hub notes — strongest structure)
- its **Author** (People notes)
- recurring **Entities** it mentions (people/orgs detected in the body text)
- curated **Related** posts and inline **frankreport/artvoice** cross-links

## Vault path config (Jarvis)

Jarvis reads the vault path from `~/.jarvis-config.json`:

```json
{ "vaultPath": "C:/dev/BensonIQ/frank_report/vault" }
```

Use forward slashes (valid JSON). Or set the `JARVIS_VAULT_PATH` env var, or use
the in-app First-Run Setup screen. The README in `jarvis-ui/` mentions
`VITE_VAULT_PATH`, but the **server** actually reads the config file / env var above.

## Scaling to the full archive

1. `FR_TARGET=all npm run ingest` (caches all ~12k posts to `data/raw/posts.json`)
2. `npm run build`
3. Restart Jarvis (or POST `/api/config` again) to rebuild the graph.

Entity extraction is precision-tuned for a clean graph; on the full corpus you
may want to raise `minDocFreq` in `build-vault.mjs` (currently 4) to keep entity
counts manageable.

## Content note

All article content belongs to Frank Parlato / FrankReport.com. This vault is a
local personal/working archive for reading and graph exploration.
