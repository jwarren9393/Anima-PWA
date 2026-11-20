# Anima PWA — Project Reference

> Technical encyclopedia for the **web** rebuild.  
> Flutter product/mechanics blueprint (read-only): [`LEGACY_FLUTTER_REFERENCE.md`](LEGACY_FLUTTER_REFERENCE.md).  
> Agent status: [`AGENTS.md`](AGENTS.md). User guide: [`README.md`](README.md).

**Last updated:** 2026-11-19 · **Phase:** 4 · Layout: [`UI_LAYOUT_GUIDE.md`](UI_LAYOUT_GUIDE.md)

---

## 1. What this app is

**Anima PWA** is a ground-up, **100% client-side** Progressive Web App rebuild of the personal Flutter Anima roleplay app. All library data lives in the browser (IndexedDB via Dexie). AI calls go directly to [NanoGPT](https://nano-gpt.com) with the user’s own API key.

---

## 2. Stack

| Layer | Choice |
|-------|--------|
| Framework | Vite 8 + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS **v4** + `@tailwindcss/vite` (`@import "tailwindcss"`) |
| PWA | `vite-plugin-pwa`, `registerType: 'autoUpdate'`, standalone display |
| Storage | Dexie (IndexedDB) — chats, cards, lore, settings, media blobs |
| Tests | Vitest + jsdom + `fake-indexeddb` |
| AI | Browser `fetch` → NanoGPT OpenAI-compatible APIs |

**No backend server. No bundled API key.**

---

## 3. Security

| Rule | Detail |
|------|--------|
| API key | Stored in Dexie `settings` under `nanogpt_api_key` only |
| Backups | `.anima-backup` **never** includes or restores the API key |
| Git | `.gitignore` excludes `.env`, `api_key.txt`, `*.anima-backup` |

---

## 4. Dexie schema (v1)

Database name: `anima-pwa`

| Table | Key | Purpose |
|-------|-----|---------|
| `characters` | `id` | ST-compatible character cards |
| `categories` | `id` | Anima character categories |
| `personas` | `id` | `{{user}}` personas |
| `chatSessions` | `id` | Solo/group sessions + embedded messages |
| `lorebooks` | `id` | Global lorebooks |
| `workshops` | `id` | Creation Center workshops |
| `settings` | `key` | String preferences + API key |
| `favoriteModels` | `id` | Starred NanoGPT models |
| `composerDrafts` | `chatId` | Unsent composer text |
| `roadwayCache` | `chatId` | Cached Paths options |
| `media` | `id` | Avatar / chat background blobs |
| `worldFiles` | `fileName` | Living World notebook JSON |

### Chat roles

`user` | `assistant` | `narrator` | `director` — assistants may carry `swipes` / `swipeIndex`; group assistants may carry `speakerId` / `speakerName`.

---

## 5. `.anima-backup` format

Matches Flutter `anima_backup_v1` (`docs/legacy/LEGACY_BACKUP_CODEC.dart`):

```json
{
  "format": "anima_backup_v1",
  "createdAt": "<ISO-8601>",
  "files": { "<whitelist document>": "<text>" },
  "avatars": { "<safe-filename>": "<base64>" },
  "chatBackgrounds": { "...": "<base64>" },
  "worlds": { "<name>.json": "<json text>" },
  "settings": { "<preference key>": "<string>" }
}
```

**Document whitelist:** `anima_characters.json`, `anima_chats.json`, `anima_personas.json`, `anima_character_categories.json`, `anima_lorebooks.json`, `anima_world_workshops.json`, `anima_composer_drafts.json`, `anima_roadway_cache.json`, `anima_settings.json`, `anima_active_persona_id.txt`.

**Service:** `src/services/backupCodec.ts` — `decodeBackup`, `restoreBackupToDb`, `exportBackupFromDb`.

Restore replaces library tables, preserves any existing device API key, and decodes base64 images into `media` blobs.

---

## 6. NanoGPT integration

**Service:** `src/services/nanogpt.ts`

| Use | URL |
|-----|-----|
| Chat PAYG | `https://api.nano-gpt.com/api/v1/chat/completions` |
| Chat subscription | `https://api.nano-gpt.com/api/subscription/v1/chat/completions` |
| Models | `/api/v1/models` (+ `detailed=true`) |
| Credits | **POST** `/api/check-balance` (`usd_balance`, `nano_balance`) |

- Auth: `Authorization: Bearer <key>`
- Streaming: SSE via `parseSseChatStream`; `AbortController` → `NanoGptCancelledException` with `partialText`
- CORS failures surface a clear browser/origin message

---

## 7. UI map (Phases 1–4)

Stack navigation only — **no bottom tabs**. Visual language: Obsidian Gold (Outfit / Plus Jakarta Sans).

- **Home:** Anima + gear; Creation Center strip when workshops exist; solo + group chat list; FAB **New** → Solo / Group / New workshop
- **Settings hub:** API → World (Personas, Characters, Lore, Creation Center, Living Worlds stub) → AI stubs → App (Appearance, Backup)
- **Group setup / Manage cast:** ≥2 cast, reply order, Auto-reply, Note, Lore
- **Chat:** Close · title · ⋮; cast chips; **Group react** beat cards; join catch-up + presence boundary on prompts; Paths last; You long-press Impersonate/My line
- **Creation Center:** workshop list + brainstorm chat + export summary to lorebook
- **Field wands:** ✦ on character/persona multiline fields; expand levels + cross-reference another card
- **Appearance / Theme Studio:** Classic ↔ Storybook, bubble opacity, corner radius, speaker header / side hero flags
- **Subviews:** Characters / Personas / Lore / API / Backup with `PageHeader`

### Group services

| Module | Role |
|--------|------|
| `groupSpeakerInference.ts` | Manual Continue speaker pick + handoff nudge |
| `groupReplyService.ts` | Group react prompt + `Name:` parse |
| `groupBeatCodec.ts` | Flatten / JSON swipe encode |
| `presenceService.ts` | Join-index filter + catch-up block + knowledge boundary |

### Workshops / theme / wands

| Module | Role |
|--------|------|
| `workshopRepository.ts` | Dexie CRUD for `WorldWorkshop` |
| `fieldWandService.ts` | NanoGPT field expand |
| `chatExperienceSettings.ts` | Persist + apply Classic/Storybook CSS vars |

---

## 8. Character / persona card codecs

| Service | Formats |
|---------|---------|
| `characterCardCodec.ts` | ST V1 flat, V2/V3 JSON; PNG `chara` + `ccv3` tEXt (via `pngTextChunks.ts`) |
| `personaCardCodec.ts` | Anima persona JSON; AI-written `looks`/`backstory`/`motivations` aliases |

---

## 9. Lore keyword scanner

`lorebookService.scanLorebooks()`:

- Scan recent messages (`scanDepth`)
- Match entry `keys` (word-boundary-ish, case-insensitive); `constant` always on; optional `selective` + secondary keys
- Sort by priority; enforce `tokenBudget`
- Optional recursive scan (matched content can unlock more entries)
- Split hits into before/after character for PromptBuilder
- Toast labels surface in chat as “Lore Triggered: …”

---

## 10. Prompt assembly (solo)

`promptBuilder.buildChatCompletionMessages()` order (legacy §10):

1. System: card system / default seed → identity → lore before → description/personality/scenario/examples → lore after → persona → global system
2. Optional memory summary system block (stored string; Scene/Ledger UI is Phase 3)
3. History within token budget (narrator→system, director deferred, user/assistant as-is)
4. Continue nudge when `mode === 'continueScene'`
5. Post-history: global + card post-history + Author's Note + first-person rule
6. Late Director mandatory block (pending note only; skipped for impersonate)

Macros: `{{user}}` / `{{char}}` / `{{original}}`.

---

## 11. Solo chat mechanics (Phases 2–3)

- New chat seeds assistant bubble from `first_mes` / alternate greetings
- **Auto-reply default off** — Send stores user line; Continue (or Auto on) streams assistant
- **Stop** keeps partial text (`NanoGptCancelledException.partialText`)
- **Swipes** on latest assistant; **+ swipe** regenerates a new alternate
- **Edit** via tap; **Delete / Rewind / Branch** via long-press menu
- Composer draft autosaved per chat id
- **Narrator** sheet: nudge → Generate/Post → `ChatRole.narrator` timeline card
- **Director** note: pending late mandatory system block for next AI reply
- **Memory:** Scene + Ledger document (`memorySummary` + `memoryCoveredCount`); manual editor; Summarize now; optional auto-summarize every N
- **Paths:** first-person option brainstorm + combine → composer; cached in `roadwayCache`
- **Impersonate / My line…:** `PromptMode.impersonate` + optional PLAYER GUIDE; streams into a user bubble (`generationKind: impersonate`)
- **Rewrite reply:** mode presets replace/regenerate the latest assistant swipe target

---

## 12. PWA / icons

Icons generated from root `anima_icon.png` into `public/icons/`:

- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- Manifest: name **Anima**, `display: standalone`, theme `#0a0a0e`

Dev server: `server.host: true` so `npm run dev -- --host` works on LAN phones.

---

## 13. Testing

```bash
npm test          # Vitest
npm run build     # tsc -b && vite build
```

Coverage focus: Dexie schema, backup round-trip (no API key leak), SSE parse + cancel, lore scan, PromptBuilder order, ST JSON/PNG card codec, persona codec.

---

## 14. Living documents

Update `AGENTS.md` + this file + `README.md` together after meaningful changes. Never edit `LEGACY_FLUTTER_REFERENCE.md`.
