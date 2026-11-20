# Anima UI Layout Guide

> **Purpose:** Visual / chrome blueprint for a ground-up PWA rebuild in a sibling repo.  
> **Scope:** How the app **looks** and how controls are **arranged**.  
> **Not in scope:** Prompt mechanics, API, persistence, Living World engine — see `PROJECT_REFERENCE.md`.  
> **Rule:** Document the current Flutter app only. Do not redesign. Do not invent screens.  
> **Source of truth:** `lib/screens/*`, `lib/widgets/*`, `lib/theme/*`, `lib/models/theme_palette.dart`, `lib/models/chat_experience_settings.dart` (build 82 era).

---

## 1. Visual language

### Background

- App root wraps content in **`GlassBackdrop`** (`main.dart` → MaterialApp builder).
- **Default preset = Obsidian Gold:** glass surfaces + **soft-glow** backdrop (dark gradient + accent glow blobs + vignette). No sparkle / grid texture.
- Modes (`BackgroundMode`): **solid** | **gradient** | **softGlow**.
- Surfaces (`VisualStyle`): **glass** (semi-transparent panels, blur) | **solid** (opaque).
- Scaffold is often **transparent** under glass so the backdrop shows through.

### Accent / palette (Obsidian Gold defaults)

| Role | Approx hex |
|------|------------|
| Background | `#050508` |
| Background alt | `#0A0A12` |
| Surface / glass | `#14141A` |
| Surface high | `#1E1E28` |
| Accent (gold) | `#E8C547` |
| Accent deep | `#B8860B` |
| Text (ink) | `#F4F0E6` |
| Text muted | `#B8B0A0` |
| User bubble | gold-deep-ish (`#B8860B` @ ~90% α) |
| AI bubble | near-black (`#1A1A1F` @ ~70% α) |
| Error | `#FF6B6B` |

Other presets exist (Midnight Sapphire, Emerald Noir, Rose Aurora, Slate Minimal, Ivory Ink, Cyber Violet, Forest Dusk) — same chrome structure, different colors.

**Ivory Ink** (light): paper bg `#F6F1E8`, ink accent `#8B5E34`, **Merriweather** headings + **Source Serif** body.

### Fonts

| Surface | Default (Obsidian Gold) |
|---------|-------------------------|
| AppBar / headings | **Outfit** (sans), bold |
| Body / lists / fields | **Plus Jakarta Sans** |
| Chat bubble body | Same body font × `chatFontScale` |
| Ivory Ink | Serif pair (Merriweather / Source Serif) |

Choices available in Theme Studio: Outfit, Plus Jakarta Sans, Inter, Merriweather, Source Serif, System.

### RP text rendering (`RpRichText`)

| Markup | Look |
|--------|------|
| `*actions / narration*` | Accent/action color, **italic**, weight 500; asterisks kept visible |
| `"dialogue"` | Dialogue emphasis color, **normal**, weight **600**; quotes kept visible |
| Plain | Muted / bubble foreground, weight 400 |

### Classic vs Storybook chat

| | **Classic** (default) | **Storybook** (preset toggle) |
|--|------------------------|-------------------------------|
| Bubble max width | ~68% screen | ~88% screen |
| Bubble opacity | 100% | **48%** default (slider) |
| Line height | 1.4 | 1.55 |
| Message spacing | 6 | 10 |
| Speaker header (avatar + name above bubble) | Off | **On** |
| Side hero portrait inside bubble | Off | **On** (portrait fades into text) |
| Classic avatar placement | Small avatar **beside** bubble (left AI / right user) | Header or hero strip; beside-avatar omitted when header on |
| Chat background image | Off | On by default (user may pick image + blur) |

User bubbles: right-aligned, accent border stronger. AI: left-aligned, softer accent border + shadow.

### Shape / buttons / icons

- **Corner radius:** default **16** (Theme Studio slider); bubbles use same clamped 12–24.
- **Icons:** Material outlined style; **accent-colored** in AppBar / list leading icons.
- **Filled (primary CTA):** solid accent gold, dark-on-gold text, no elevation.
- **Outlined:** gold/accent stroke ~55% α, accent foreground.
- **Tonal / selected chrome:** filled tonal for “on” states (Director on, Continue, active Guide AI).
- **FAB:** extended, accent fill, slightly rounder than cards.
- **Chips / InputChips:** gold-tint border; selected = accent-deep wash.
- **Bottom sheets:** surface bg, top radius ≈ cornerRadius + 6, drag handle common.
- **Dialogs:** surface + thin accent border, radius ≈ cornerRadius + 4.

---

## 2. App shell / navigation

```
Home (root)
 ├─ AppBar gear → Settings hub
 ├─ FAB “New” → sheet: Solo / Group / New workshop
 ├─ Creation Center strip (if workshops exist) → workshop chat or “All worlds”
 └─ Chat list → ChatScreen

Settings hub (push routes only — no bottom nav)
 ├─ API & connection (pinned card at top)
 ├─ World: Personas · Characters · World Info & lore · Creation Center · Living Worlds
 ├─ AI: Generation parameters · Global chat prompts · AI collaborator · Character & persona builds
 └─ App: Data folder · Appearance · Backup, restore & sync
```

- **No tab bar / drawer.** Stack navigation (`Navigator.push`).
- **Home FAB:** bottom-right **extended** — icon `+` + label **New**.
- **Home gear:** AppBar **trailing** `settings_outlined`.
- **Desktop vs Android:** same routes; differences are mostly **chat composer chrome** (see §4). Enter-to-send is desktop-oriented (Settings → AI collaborator).

---

## 3. Screen-by-screen layout

### Home (chat list)

```
┌─────────────────────────────┐
│ Anima                  [⚙]  │
├─────────────────────────────┤
│ Creation Center  [All worlds]│  ← only if workshops exist
│ [Continue card] [card] …    │  ← horizontal 88px strip
├─────────────────────────────┤
│ ◎ Title                     │
│   preview · date            │  ← ListTile; group = groups icon avatar
│ …                           │
│                    [ + New ]│  ← FAB.extended
└─────────────────────────────┘
```

- **Purpose:** Journal of chats + shortcut into Creation Center.
- **Empty:** centered chat icon, “No chats yet”, copy about journal, **Start a chat** filled button.
- **Long-press row:** delete confirm dialog.
- **New sheet order:** Solo chat → Group chat → New workshop.

### Chat (solo) — see §4 for chrome detail

- **Purpose:** One character + persona RP thread.
- **Header:** Close · character name + chat title subtitle · ⋮
- **Body:** message list (or empty state); optional blurred chat background (Storybook).
- **Bottom:** Living World chips (if bound) → Note/Moods chips → voice row → Write/Guide toggle → Director|Continue (Android) → composer row.
- **Empty:** “Chat with {name}” + Manage characters / Start new chat (or Open Settings if no key).
- **Errors:** banner **above composer**, dismissible — never bottom snack toast for chat errors.
- **Lore hits:** brief **top overlay** “Lore Triggered: …”.

### Group setup / Manage cast

- **AppBar:** “New group chat” or “Manage cast”.
- **Body:** title field; category filter; checklist of characters; **Reply order** reorderable list when ≥2; chip row **Lore (N)** · **Note / Add note** · **Auto-reply | Manual**.
- **Bottom CTA:** filled “Start group chat” (≥2) or “Save cast…”.
- **Group chat screen:** same `ChatScreen`; AppBar subtitle = “N characters”; voice row includes cast + **Group react** chip; + sheet adds Group react.

### Settings hub

Order (exact):

1. **API & connection** — highlighted card (link/key icon, model status or “No API key”)
2. Section **World** — Personas · Characters · World Info & lore · Creation Center · Living Worlds
3. Section **AI** — Generation parameters · Global chat prompts · AI collaborator · Character & persona builds
4. Section **App** — Data folder · Appearance · Backup, restore & sync
5. Footer note about `api_key.txt` in Anima folder

Section headers = accent-colored labelLarge. Rows = icon · title · optional subtitle · chevron.

### API & connection

- AppBar: **API & connection**
- Sections stacked: NanoGPT API key (field + Save / Clear) → See remaining credits → AI model (category / context / provider filters + Browse models) → Image model → Subscription URL toggle → Save model & connection.
- Status line style mirrors Settings card.

### Characters list + editor

**List**

- AppBar: Characters | import download icon
- Optional persona bar when opened as **pick for new solo chat**
- Hint text · category filter · Full cards only filter
- Rows: avatar · name + ~token badge · subtitle · ⋮ (Edit / Categories / Export / Delete…)
- Empty: “No characters yet.”
- FAB: **New**

**Editor**

- AppBar title = name / New character · ⋮ (Consistency · Compact · Expand · Base on another card · avatar actions)
- Optional **AI busy banner** under AppBar
- Section chips: **Identity · Story · Chat · Lore · Advanced** (one panel visible)
- Bottom: **Save** filled button
- Field wands (sparkle) on creative fields

### Personas list + editor

**List**

- AppBar: Personas | import upload
- Rows include optional **Plain User**; ~token badges; ⋮ set default / edit / delete
- FAB: **New**

**Editor**

- Single scrolling form (identity, appearance, personality, background, goals…) + Generate avatar
- ⋮ Compact / Expand / Base on another card
- AI busy banner same pattern as characters

### World Info & lore

**Hub (`LoreSettingsScreen`)**

- Global lorebooks → button into list
- Scan behavior: depth, token budget, recursive switch
- Link to per-character books (opens Characters)

**Global lorebooks list**

- AppBar + FAB New; rows with ~tokens, enable toggle pattern, open editor

### Backup & restore

- AppBar: **Backup & restore**
- Prose explanation → **Create backup** (filled) → **Restore backup** (outlined)
- Desktop: Save dialog; Android: share sheet (copy differs by platform)

### Creation Center (high level)

**List**

- AppBar: Creation Center | import actions
- Workshop rows (pin / duplicate / delete via menu)
- Empty: Import CTA
- FAB: new workshop

**Workshop chat**

- Minimal chrome reminiscent of main chat (⋮ leads with API & connection)
- Composer with ▶ Continue when needed; Stop while streaming
- Chip toolbar for mode / length / import / ideas (compact workshop toolbar)
- Not a full clone of chat chrome — world-building collaborator, not RP cast voice row

### Appearance / Theme Studio (high level)

```
[ Live preview card ]
[ Presets | Layout | Colors | Fonts | Chat | Avatars ]  ← one category visible
…controls…
[ Save ]
```

- **Chat** category: Classic ↔ Storybook segmented control; background image; blur; bubble opacity; speaker header; side hero portrait.
- AppBar **Reset** restores selected preset defaults.

---

## 4. Chat chrome map (critical)

### App bar

```
[✕ Close]   Title (character or group name)
            Subtitle (chat title | “N characters”)          [⋮]
```

### ⋮ menu — item ORDER

1. API & connection  
2. Persona: {name} / Switch persona  
3. Author's Note  
4. Living World bind label (always)  
5. *(if world bound)* Update world from chat…  
6. *(if bound)* Update character from world…  
7. *(if bound)* Advance world a beat…  
8. *(if bound)* World play mode…  
9. *(if bound + pending)* Review pending world changes (N)  
10. *(if bound)* World log…  
11. *(if bound)* Undo last world update  
12. *(if chat overrides)* Chat copies…  
13. Memory summary / Memory summary (set)  
14. Summarize now  
15. Context estimate  
16. Manage cast  
17. —— divider ——  
18. Open in Creation Center  
19. Export chat  
20. Import chat  
21. Settings  

### Rows above composer (bottom → top = listed top → bottom in UI)

When keyboard **open** on Android: hide Note/Moods chips and voice row padding tightens; Living World chips may still show.

| Row | When visible |
|-----|----------------|
| Review pending (N) / World updated · N | Living World bound + pending or ambient apply |
| Note · Moods (N) chips | Authors note set and/or moods on; **hidden while keyboard open** |
| Voice chips: You · cast… · [Group react] | Not in Director mode; **hidden while keyboard open** |
| Write line \| Guide AI toggle | A cast chip is selected as composer voice; not Director |
| Director \| Continue (full-width pair) | **Android / non-desktop only** |
| Composer tools row | Always (layout differs by platform) |

**Voice chip behavior**

- **You** — tap: write as persona; **long-press** → sheet Impersonate / My line…  
- **Cast name** — tap: force AI reply as that speaker (groups) / select; **long-press** → enter **Guide AI** for that character  
- After Guide AI send → voice returns to **You** (no auto-keyboard pop)  
- **Group react** chip — groups with ≥2 cast only  

**Write line vs Guide AI:** selected mode = filled tonal; other = outlined.

**Director:** outlined when off; **filled tonal “Director on”** when on (same visual family as Continue). Composer border goes accent; hint becomes direction text.

### Composer row

**Android (`compactComposer`)**

```
[+]  [ text field ........................ ]  [Send] or [Stop]
```

- `+` = `add_circle_outline` → Composer tools sheet  
- Send = filled square icon button; Stop = **red** filled stop while streaming  

**Desktop**

```
[Mood] [Narrator] [Director]  [ field .... ]  [▶] [Send]
```

- Mood / Narrator / Director as icon buttons in-row (Director filled tonal when on)  
- ▶ Continue beside Send (not the Android dual-button row)  

**Placeholder variants**

| State | Hint |
|-------|------|
| Director on | Direct the scene — how they act, feel, respond… |
| Guide AI voice | Guide {Name} — what they do, feel, or say… |
| Write line voice | Write as {Name}… |
| Group | Message the group… |
| Solo + auto-reply | Message {Name}… |
| Solo default | Send only — tap Continue for a reply |

### + / Composer tools sheet (Android)

Title: **Composer tools**

1. Scene moods / Scene moods (N on)  
2. Narrator  
3. Group react *(groups only)*  

### How major features are opened (UI entry points)

| Feature | How opened |
|---------|------------|
| Narrator | Android `+` sheet · Desktop Narrator icon · (not message menu) |
| Director | Android Director button / Desktop Director icon · toggle mode |
| Scene moods | `+` / Mood icon · Moods chip when active |
| Author’s Note | ⋮ Author's Note · Note chip when set |
| Memory | ⋮ Memory summary only (no composer chip) |
| Paths | Message long-press → **Paths** (last item) |
| Impersonate / My line | Long-press **You** chip |
| Guide AI | Long-press cast chip (or Write/Guide toggle after selecting cast) |
| Rewrite | Message long-press → Rewrite reply… → rewrite sheet |
| Continue | Android Continue button · Desktop ▶ · (not message menu) |
| Group react | Voice chip · `+` sheet |

### Message interactions

- **Tap bubble** → edit in place  
- **Long-press bubble** → actions sheet (~55% height, scrollable)  
- **Narrator / Director cards:** centered; tap = edit; long-press = Edit / Delete sheet  
- **Group react card:** centered multi-line card; tap = edit lines; long-press = same message menu  

### Message actions sheet — full list

| # | Title | Subtitle / rules |
|---|--------|------------------|
| 1 | Delete | Remove only this message |
| 2 | Rewind to here | “Delete every message after…” · **disabled** if already last (“Already the last message”) |
| 3 | Regenerate / Regenerate group react / Regenerate my line | Shown for AI / group-beat / impersonate bubbles. Subtitle: steer hint if saved, else “again” or “Removes later messages…” if not last |
| 4 | Rewrite reply… | Only non–group-beat, non-impersonate AI · “Shorten, expand, change mood, or custom” |
| — | divider | |
| 5 | Branch from here | New chat with history up to this message |
| 6 | Previous swipe | Only if AI + ≥2 swipes; disabled on first |
| 7 | Next swipe | Disabled on last existing swipe |
| 8 | **Paths** | Brainstorm what you could do or say next · **always last** |

Not in this menu (removed from message long-press): Narrator, Continue, Group react, Auto-reply, New swipe, Impersonate, My line.

### Swipe controls

- Under AI (and group-beat) bubbles: compact **◀ 1/N ▶** (`_SwipePager`), aligned with bubble column.  
- On **latest** AI message, ▶ past last version **generates a new swipe**.  
- Older multi-swipe bubbles: arrows browse only.  
- Avatars are **not** the swipe control; pager sits under the bubble.

### Classic vs Storybook bubble wireframe

```
Classic AI:                 Storybook AI:
[avatar] [ bubble     ]     [ avatar Name ]
         [◀ 1/2 ▶]          [ bubble | hero ]
                            [◀ 1/2 ▶]
```

---

## 5. Component patterns

### Bottom sheets vs dialogs vs overflow

| Pattern | Used for |
|---------|----------|
| **Modal bottom sheet** (+ drag handle) | New chat type, composer tools, message actions, You-chip menu, Paths, moods, narrator, rewrite, lore pickers, most pickers |
| **AlertDialog** | Destructive confirms (delete chat/character), restore replace-everything |
| **PopupMenuButton (⋮)** | Chat overflow, character/persona row menus, editor AI/avatar menus |
| **Full-screen push** | Settings children, editors, group setup, Creation Center, Theme Studio |

### List row anatomy (Home / Characters / Personas)

```
[ Avatar 40ish ]  Title (+ optional ~token badge)
                  Subtitle / preview · timestamp          [⋮?]
```

- Group chats: `CircleAvatar` + groups icon instead of portrait.  
- Dividers between rows; bottom padding ~88 for FAB clearance.

### Settings row anatomy

```
[ accent Icon ]  Title
                 Subtitle (optional)                      [›]
```

- Section label above groups: accent `labelLarge`, padding 20/16/20/4.  
- API card is a padded Material ink well, not a plain ListTile.

---

## 6. Do / Don’t for the PWA rebuild

**Do — must match to “feel like Anima”**

1. **Close · title · ⋮** chat header (not back-chevron primary); ⋮ leads with **API & connection**.  
2. Preserve **composer hierarchy**: voice chips → Write/Guide → Director/Continue (mobile) → field + Send/Stop.  
3. Keep **RP typography**: italic gold-ish `*actions*` vs bolder `"dialogue"`.  
4. **Obsidian Gold** as default: near-black glass + soft glow + gold accent CTAs (outline vs filled).  
5. Message long-press menu order ending with **Paths**; Rewind disabled on last message.  
6. **Swipe pager under bubbles** (`◀ n/N ▶`), not a fat action bar under every message.  
7. Impersonate / My line on **You chip long-press**; Guide AI on **cast long-press** — not buried in message menu.  
8. Errors as **in-chat banners above composer**; lore as brief **top** toast.  
9. Settings hub **World / AI / App** grouping and order.  
10. Home: title **Anima**, gear top-right, **New** extended FAB, Solo/Group/Workshop sheet.

**Don’t**

- Don’t invent bottom-tab navigation or a SillyTavern-style multi-panel desktop chrome.  
- Don’t put Narrator / Continue / Impersonate back into the message long-press menu.  
- Don’t assume Storybook is always on — **Classic is default**; Storybook changes opacity, headers, heroes, spacing.  
- Don’t hard-code only gold if Theme Studio presets matter — structure is fixed, colors are theme tokens.  
- Don’t toast chat failures at the bottom over the composer.

**Theme-dependent callouts**

- Bubble opacity, speaker names, side portraits, chat background → **Storybook / Chat experience**.  
- Glass blur vs solid flat → **VisualStyle / BackgroundMode**.  
- Heading serif vs sans → preset (Ivory Ink vs Obsidian Gold).  
- Android vs desktop composer icon layout → **platform**, not theme.

---

## Related docs

| File | Use |
|------|-----|
| `PROJECT_REFERENCE.md` | Mechanics / architecture encyclopedia |
| `AGENTS.md` | Status, roadmap, code map |
| `README.md` | User-facing feature catalog |
| This file | Layout / chrome only for visual rebuilds |
