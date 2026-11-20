# Anima PWA — Agent Guide

> Living status doc for Cursor agents. Product blueprint (read-only): [`LEGACY_FLUTTER_REFERENCE.md`](LEGACY_FLUTTER_REFERENCE.md).  
> Tech encyclopedia: [`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md). User guide: [`README.md`](README.md).  
> Layout: [`UI_LAYOUT_GUIDE.md`](UI_LAYOUT_GUIDE.md). Flutter sibling: `../Anima`.

**Last updated:** 2026-11-19 · **Phase:** 4 · **Stack:** Vite + React + TypeScript + Tailwind v4 + Dexie + vite-plugin-pwa

---

## Current status

Phases **1–4** pass `npm test` + `npm run build`.

| Phase | Highlights |
|-------|------------|
| **1** | Scaffold, PWA, Dexie, NanoGPT client, `.anima-backup`, Home / API / Backup |
| **2** | Characters/Personas/Lore CRUD, ST JSON/PNG, PromptBuilder, solo streaming chat |
| **3** | Narrator & Director cards, Scene/Ledger memory, Paths, Impersonate / My line…, Rewrite reply |
| **UI** | Obsidian Gold tokens; stack nav; Home + Settings hub; solo chat §4 chrome |
| **4** | Groups + Group react + join catch-up; Creation Center; field wands / cross-ref; Theme Studio |

Still lighter than Flutter: Living Worlds factory, full presence sanitization, Generation parameters screens, Storybook side-hero portraits.

NanoGPT notes: use `api.nano-gpt.com`; check-balance is **POST**; browser Allowed origins = empty or `http://localhost:…` only (no LAN IPs).

---

## Four-phase roadmap

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Scaffold, PWA, Dexie, NanoGPT, backup, shell | **DONE** |
| **2** | Cards, lore scanner, PromptBuilder, solo chat | **DONE** |
| **3** | Narrator/Director, memory, Paths, Impersonate, Rewrite | **DONE** |
| **4** | Groups, Creation Center, wands, Theme Studio | **DONE** (MVP) |

---

## Architecture rules

1. **100% client-side.** No Anima backend.
2. **API key** only in IndexedDB — never in git or `.anima-backup`.
3. **Do not edit** `LEGACY_FLUTTER_REFERENCE.md`.
4. **Tailwind v4** via `@tailwindcss/vite` only.
5. Match Flutter mechanics where Phase docs specify them; read `../Anima/lib` for chrome/menus.
6. Run `npm test` / `npm run build` after meaningful changes.

---

## Code map

```
src/services/
  backupCodec.ts | nanogpt.ts | settingsStore.ts | generationSettings.ts
  characterCardCodec.ts | personaCardCodec.ts | pngTextChunks.ts
  lorebookService.ts | promptBuilder.ts
  chatRepository.ts | libraryRepository.ts | workshopRepository.ts
  groupSpeakerInference.ts | speakerPrefix.ts | groupBeatCodec.ts
  groupReplyService.ts | presenceService.ts | fieldWandService.ts
  chatExperienceSettings.ts
  narratorService.ts | roadwayService.ts | replyRewriteService.ts
  memorySummary.ts | memoryService.ts
src/navigation.ts
src/components/
  FieldWandButton.tsx | layout/PageHeader.tsx | chat/ChatSheets.tsx
  views/HomeView | SettingsHubView | ChatView | GroupChatSetupView
  CreationCenterView | WorkshopChatView | ThemeStudioView | …
```

Chrome: Close·title·⋮; You long-press → Impersonate/My line; Paths last; groups cast chips + Group react; Manage cast; Theme Studio Classic/Storybook.

---

## Living-doc upkeep

Update `AGENTS.md` + `PROJECT_REFERENCE.md` + `README.md` together after meaningful work. Never edit the Flutter legacy reference.

---

## Next polish (optional)

1. Deeper presence (observable RP asterisk filtering, staging sanitize)
2. Group beat swipe regen / edit sheet
3. Generation parameters + global prompts settings screens
4. Living Worlds bind / factory
5. Full Theme Studio palettes beyond Obsidian Gold

---

## Dev commands

```bash
npm run dev -- --host
npm test
npm run build
```
