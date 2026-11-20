# Anima

Private, **local-first** AI character roleplay as a Progressive Web App. Your chats, characters, personas, lorebooks, workshops, and settings live on **this device** (IndexedDB). The app talks directly to [NanoGPT](https://nano-gpt.com) with **your** API key — there is no Anima server.

---

## What you can do today (Phases 1–4)

- **Home** — chat list (solo + group), Creation Center strip, gear → Settings, FAB New → Solo / Group / Workshop
- **Settings hub** — API, World (Personas / Characters / Lore / Creation Center), Appearance, Backup
- **Solo chat** — Close·title·⋮; streaming, Stop, Continue, Director, swipes, edit, rewind, branch
- **Group chat** — cast setup, speaker chips, Continue inference, Manage cast, **Group react** beats, mid-chat join catch-up
- **Creation Center** — workshop brainstorm chat; export summary to a lorebook
- **Field wands** — ✦ on character/persona fields (expand + cross-reference another card)
- **Appearance** — Classic vs Storybook chat layout, opacity, radius
- **Narrator & Director** — scene cards from composer chrome
- **Memory / Author's Note** — chat ⋮ menu
- **Paths** — message long-press → Paths (last)
- **Impersonate / My line…** — long-press **You** chip
- **Rewrite reply** — message long-press
- **API & connection** — NanoGPT key, PAYG vs Subscription, test, credits, models
- **Backup & restore** — `.anima-backup` (API key never included)

Optional later polish: Living Worlds, deeper presence filtering, full Theme Studio palettes, generation-parameter screens.

---

## Quick start

```bash
npm install
npm run dev -- --host
```

1. Open `http://localhost:5173` (use localhost on PC; NanoGPT only allows `http://localhost:…` or HTTPS for origin allowlists — leave Allowed origins **empty** for phone/LAN testing).
2. **API & connection** → save key → Test connection → Browse models → pick a default.
3. Import a `.anima-backup` or a character card, then **Home → New**.

```bash
npm test
npm run build
```

---

## Docs for agents

- [`AGENTS.md`](AGENTS.md) — status / roadmap / code map  
- [`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md) — technical encyclopedia  
- [`UI_LAYOUT_GUIDE.md`](UI_LAYOUT_GUIDE.md) — Flutter chrome blueprint  
- [`LEGACY_FLUTTER_REFERENCE.md`](LEGACY_FLUTTER_REFERENCE.md) — read-only product blueprint (do not edit)
