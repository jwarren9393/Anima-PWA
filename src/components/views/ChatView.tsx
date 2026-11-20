import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RpText } from '../RpText'
import {
  AuthorsNoteSheet,
  DirectorSheet,
  GroupReactSheet,
  MemorySheet,
  MyLineSheet,
  NarratorSheet,
  PathsSheet,
  RewriteSheet,
} from '../chat/ChatSheets'
import { newId } from '../../lib/ids'
import type { Character, ChatMessage, ChatSession, Persona } from '../../models/types'
import {
  addAssistantSwipe,
  assistantText,
  branchFromMessage,
  getChat,
  getComposerDraft,
  GROUPS_KEY,
  rewindToMessage,
  saveChat,
  setComposerDraft,
  withAssistantText,
} from '../../services/chatRepository'
import {
  advanceSpeakerIndex,
  buildHandoffNudge,
  resolveGroupSpeaker,
} from '../../services/groupSpeakerInference'
import {
  getCharacter,
  getPersona,
  listLorebooks,
  listPersonas,
} from '../../services/libraryRepository'
import { stripLeadingSpeakerPrefix } from '../../services/speakerPrefix'
import {
  getAutoSummarizeEvery,
  getGlobalPrompts,
  getLoreScanSettings,
  getSamplingSettings,
  setAutoSummarizeEvery,
} from '../../services/generationSettings'
import {
  buildChatCompletionMessages,
  selectHistory,
  type PromptMode,
} from '../../services/promptBuilder'
import {
  activeBeatLines,
  encodeAllBeatSwipes,
  flattenBeat,
} from '../../services/groupBeatCodec'
import {
  beatMaxTokens,
  buildBeatMessages,
  linesToBeatParts,
  parseBeatReply,
  priorBeatAvoidText,
} from '../../services/groupReplyService'
import {
  NanoGptCancelledException,
  completeChat,
  streamChatCompletion,
} from '../../services/nanogpt'
import {
  buildCatchUpBlock,
  filterMessagesFromJoinIndex,
  joinIndexFor,
} from '../../services/presenceService'
import { formatPersonaPromptBlock } from '../../services/personaCardCodec'
import { getApiKey, getChatModelId, getUseSubscription } from '../../services/settingsStore'
import { generateNarratorLine } from '../../services/narratorService'
import {
  combinePaths,
  generatePaths,
  loadRoadwayCache,
  saveRoadwayCache,
} from '../../services/roadwayService'
import {
  shouldAutoSummarize,
  summarizeSessionMemory,
} from '../../services/memoryService'
import type { RewriteMode } from '../../services/replyRewriteService'

type Props = {
  chatId: string
  onClose: () => void
  onOpenApi: () => void
  onOpenSettings: () => void
  onManageCast?: () => void
  onBranched: (newChatId: string) => void
}

type MenuState = { messageId: string } | null
type Sheet =
  | 'narrator'
  | 'director'
  | 'paths'
  | 'myline'
  | 'rewrite'
  | 'memory'
  | 'note'
  | 'you'
  | 'tools'
  | 'groupReact'
  | null

export function ChatView({
  chatId,
  onClose,
  onOpenApi,
  onOpenSettings,
  onManageCast,
  onBranched,
}: Props) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [character, setCharacter] = useState<Character | null>(null)
  const [cast, setCast] = useState<Character[]>([])
  const [persona, setPersona] = useState<Persona | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loreToast, setLoreToast] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menu, setMenu] = useState<MenuState>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [directorOn, setDirectorOn] = useState(false)
  const [pathOptions, setPathOptions] = useState<string[]>([])
  const [pathDirection, setPathDirection] = useState('')
  const [autoEvery, setAutoEvery] = useState(0)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  )
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const draftTimer = useRef<number | null>(null)
  const summarizingLock = useRef(false)

  const isGroup = Boolean(
    session?.isGroup || (session?.participantIds?.length ?? 0) > 1 || cast.length > 1,
  )

  const reload = useCallback(async () => {
    const chat = await getChat(chatId)
    if (!chat) {
      setError('Chat not found.')
      return
    }
    setSession(chat)

    const groupish =
      chat.isGroup ||
      (chat.participantIds?.length ?? 0) > 1 ||
      chat.characterId === GROUPS_KEY
    if (groupish && chat.participantIds?.length) {
      const members: Character[] = []
      for (const id of chat.participantIds) {
        const c = await getCharacter(id)
        if (c) members.push(c)
      }
      setCast(members)
      const idx = chat.nextSpeakerIndex ?? 0
      setCharacter(members[idx] ?? members[0] ?? null)
    } else if (chat.characterId && chat.characterId !== GROUPS_KEY) {
      const solo = (await getCharacter(chat.characterId)) ?? null
      setCharacter(solo)
      setCast(solo ? [solo] : [])
    } else {
      setCharacter(null)
      setCast([])
    }

    const allPersonas = await listPersonas()
    setPersonas(allPersonas)
    if (chat.personaId) {
      setPersona((await getPersona(chat.personaId)) ?? null)
    } else {
      setPersona(null)
    }
    setDraft(await getComposerDraft(chatId))
    setAutoEvery(await getAutoSummarizeEvery())
    const cache = await loadRoadwayCache(chatId)
    if (cache) {
      setPathOptions(cache.options)
      setPathDirection(cache.direction ?? '')
    }
  }, [chatId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages.length, busy])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (draftTimer.current) window.clearTimeout(draftTimer.current)
    }
  }, [])

  function queueDraftSave(text: string) {
    setDraft(text)
    if (draftTimer.current) window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      void setComposerDraft(chatId, text)
    }, 400)
  }

  const lastAssistantIndex = useMemo(() => {
    if (!session) return -1
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i]?.role === 'assistant') return i
    }
    return -1
  }, [session])

  async function persist(next: ChatSession) {
    setSession(next)
    await saveChat(next)
    return next
  }

  async function maybeAutoSummarize(next: ChatSession) {
    if (summarizingLock.current) return next
    const every = await getAutoSummarizeEvery()
    if (!shouldAutoSummarize(next, every)) return next
    const apiKey = await getApiKey()
    const model = await getChatModelId()
    if (!apiKey || !model) return next
    summarizingLock.current = true
    setSummarizing(true)
    try {
      const updated = await summarizeSessionMemory({
        session: next,
        apiKey,
        model,
        useSubscription: await getUseSubscription(),
      })
      if (updated !== next) await persist(updated)
      return updated
    } catch {
      return next
    } finally {
      summarizingLock.current = false
      setSummarizing(false)
    }
  }

  function resolveSpeaker(base: ChatSession, forced?: Character | null): Character | null {
    if (forced) return forced
    if (isGroup && cast.length > 1) {
      if (base.autoReply === true) {
        const idx = base.nextSpeakerIndex ?? 0
        return cast[idx] ?? cast[0] ?? null
      }
      return resolveGroupSpeaker({
        participants: cast,
        messages: base.messages,
        primaryCharacter: character,
      })
    }
    return character
  }

  async function runGeneration(opts: {
    baseSession: ChatSession
    mode?: PromptMode
    target: 'new' | 'swipe' | 'replace' | 'impersonate'
    playerGuideNote?: string
    generationKind?: string
    speaker?: Character | null
    rewrite?: { mode: RewriteMode; currentReply: string; customInstruction?: string }
  }) {
    const speaker = resolveSpeaker(opts.baseSession, opts.speaker)
    if (!speaker) {
      setError('This chat has no character card linked.')
      return
    }
    const apiKey = await getApiKey()
    if (!apiKey) {
      setError('Add your NanoGPT API key under API & connection.')
      return
    }
    const model = await getChatModelId()
    if (!model) {
      setError('Pick a default model under API & connection.')
      return
    }

    setBusy(true)
    setError(null)
    setCharacter(speaker)
    const controller = new AbortController()
    abortRef.current = controller

    const others = isGroup ? cast.filter((c) => c.id !== speaker.id) : []
    let working = { ...opts.baseSession, messages: [...opts.baseSession.messages] }
    let targetIndex = -1
    const isImpersonate = opts.target === 'impersonate' || opts.mode === 'impersonate'

    if (opts.target === 'new' || opts.target === 'impersonate') {
      working.messages.push({
        id: newId('msg'),
        role: isImpersonate ? 'user' : 'assistant',
        text: '',
        swipes: isImpersonate ? undefined : [''],
        swipeIndex: isImpersonate ? undefined : 0,
        speakerId: isImpersonate ? undefined : speaker.id,
        speakerName: isImpersonate ? undefined : speaker.name,
        generationKind: opts.generationKind ?? (isImpersonate ? 'impersonate' : undefined),
        generationGuide: opts.playerGuideNote,
        createdAt: new Date().toISOString(),
      })
      targetIndex = working.messages.length - 1
    } else {
      for (let i = working.messages.length - 1; i >= 0; i--) {
        const m = working.messages[i]
        if (m?.role === 'assistant' || (m?.role === 'user' && m.generationKind === 'impersonate')) {
          targetIndex = i
          break
        }
      }
      if (targetIndex < 0) {
        setBusy(false)
        setError('No message to update.')
        return
      }
      const current = working.messages[targetIndex]!
      if (current.role === 'assistant') {
        working.messages[targetIndex] =
          opts.target === 'swipe'
            ? addAssistantSwipe(current, '')
            : withAssistantText(current, '')
      } else {
        working.messages[targetIndex] = {
          ...current,
          text: '',
          generationGuide: opts.playerGuideNote ?? current.generationGuide,
        }
      }
      working.messages = working.messages.slice(0, targetIndex + 1)
    }

    const promptSession: ChatSession = {
      ...working,
      messages: working.messages.slice(0, targetIndex),
    }

    await persist(working)

    const cleanText = (raw: string) =>
      isImpersonate ? raw : stripLeadingSpeakerPrefix(raw, speaker.name)

    const patchTarget = (text: string) => {
      const cleaned = cleanText(text)
      setSession((prev) => {
        if (!prev) return prev
        const messages = [...prev.messages]
        const msg = messages[targetIndex]
        if (!msg) return prev
        messages[targetIndex] =
          msg.role === 'assistant' ? withAssistantText(msg, cleaned) : { ...msg, text: cleaned }
        return { ...prev, messages }
      })
    }

    try {
      const loreBooks = await listLorebooks()
      const loreOpts = await getLoreScanSettings()
      const sampling = await getSamplingSettings()
      const globals = await getGlobalPrompts()
      const useSubscription = await getUseSubscription()
      const joinIdx = isGroup ? joinIndexFor(opts.baseSession.castJoinedAt, speaker.id) : 0
      const filteredMessages = isGroup
        ? filterMessagesFromJoinIndex(promptSession.messages, joinIdx)
        : promptSession.messages
      const promptSessionFiltered = { ...promptSession, messages: filteredMessages }
      const catchUp =
        isGroup && joinIdx > 0
          ? buildCatchUpBlock({
              messages: opts.baseSession.messages,
              joinIndex: joinIdx,
              userName: persona?.name ?? 'User',
            })
          : null
      const handoff =
        isGroup && !isImpersonate && !opts.rewrite
          ? buildHandoffNudge({
              messages: promptSessionFiltered.messages,
              endExclusive: promptSessionFiltered.messages.length,
              target: speaker,
            })
          : null

      const built = buildChatCompletionMessages({
        character: speaker,
        persona,
        session: promptSessionFiltered,
        mode: opts.mode ?? (isImpersonate ? 'impersonate' : 'normal'),
        playerGuideNote: opts.playerGuideNote,
        rewrite: opts.rewrite,
        others,
        handoffNudge: handoff,
        catchUpBlock: catchUp,
        presenceBoundary: isGroup,
        loreBooks,
        loreOptions: {
          scanDepth: loreOpts.scanDepth,
          tokenBudget: loreOpts.tokenBudget,
          recursive: loreOpts.recursive,
        },
        globalSystemPrompt: globals.system,
        globalPostHistory: globals.postHistory,
      })

      if (built.lore.triggeredLabels.length) {
        setLoreToast(`Lore Triggered: ${built.lore.triggeredLabels.slice(0, 4).join(', ')}`)
        window.setTimeout(() => setLoreToast(null), 3500)
      }

      const full = cleanText(
        await streamChatCompletion({
          apiKey,
          model,
          messages: built.messages,
          useSubscription,
          temperature: sampling.temperature,
          top_p: sampling.topP,
          max_tokens: sampling.maxTokens,
          frequency_penalty: sampling.frequencyPenalty,
          presence_penalty: sampling.presencePenalty,
          signal: controller.signal,
          onDelta: (_chunk, fullText) => patchTarget(fullText),
        }),
      )

      const latest = (await getChat(chatId)) ?? working
      const messages = [...latest.messages]
      const msg = messages[targetIndex]
      if (msg) {
        const tagged =
          msg.role === 'assistant'
            ? {
                ...withAssistantText(msg, full),
                speakerId: speaker.id,
                speakerName: speaker.name,
              }
            : { ...msg, text: full }
        messages[targetIndex] = tagged
      }
      let nextSession: ChatSession = { ...latest, messages }
      if (isGroup && !isImpersonate && opts.target === 'new' && latest.autoReply === true) {
        const idx = latest.nextSpeakerIndex ?? 0
        nextSession = {
          ...nextSession,
          nextSpeakerIndex: advanceSpeakerIndex(idx, cast.length),
        }
      }
      let saved = await persist(nextSession)
      saved = await maybeAutoSummarize(saved)
      void saved
    } catch (err) {
      if (err instanceof NanoGptCancelledException) {
        const latest = (await getChat(chatId)) ?? working
        const messages = [...latest.messages]
        const msg = messages[targetIndex]
        if (msg) {
          const partial = cleanText(
            err.partialText || (msg.role === 'assistant' ? assistantText(msg) : msg.text),
          )
          messages[targetIndex] =
            msg.role === 'assistant'
              ? {
                  ...withAssistantText(msg, partial),
                  speakerId: speaker.id,
                  speakerName: speaker.name,
                }
              : { ...msg, text: partial }
        }
        await persist({ ...latest, messages })
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  async function handleSend() {
    if (!session || busy) return
    const text = draft.trim()
    if (!text) return

    if (directorOn) {
      const msg: ChatMessage = {
        id: newId('msg'),
        role: 'director',
        text,
        createdAt: new Date().toISOString(),
      }
      const next = { ...session, messages: [...session.messages, msg] }
      setDraft('')
      await setComposerDraft(chatId, '')
      setDirectorOn(false)
      await persist(next)
      await runGeneration({ baseSession: next, mode: 'continueScene', target: 'new' })
      return
    }

    const userMsg: ChatMessage = {
      id: newId('msg'),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    }
    const next: ChatSession = {
      ...session,
      messages: [...session.messages, userMsg],
    }
    setDraft('')
    await setComposerDraft(chatId, '')
    await persist(next)
    if (next.autoReply === true) {
      await runGeneration({ baseSession: next, target: 'new' })
    }
  }

  async function handleContinue() {
    if (!session || busy) return
    await runGeneration({
      baseSession: session,
      mode: 'continueScene',
      target: 'new',
    })
  }

  async function runGroupReact(speakerIds: string[], nudge: string) {
    if (!session || busy) return
    const speakers = cast.filter((c) => speakerIds.includes(c.id))
    if (speakers.length < 2) {
      setError('Pick at least two cast members for Group react.')
      return
    }
    const apiKey = await getApiKey()
    const model = await getChatModelId()
    if (!apiKey || !model) {
      setError('API key and default model required for Group react.')
      return
    }
    setBusy(true)
    setError(null)
    setSheet(null)
    try {
      const sampling = await getSamplingSettings()
      const globals = await getGlobalPrompts()
      // Omit prior groupBeats from history (copy-paste bait); pass last as priorBeatToAvoid.
      const history = selectHistory(session.messages, {
        memoryCoveredCount: session.memoryCoveredCount,
      }).filter((m) => m.role !== 'groupBeat')
      const historyApi = history.map((m) => {
        if (m.role === 'assistant') {
          const text = assistantText(m)
          const label = m.speakerName?.trim()
          return {
            role: 'assistant' as const,
            content: label && !text.startsWith(`${label}:`) ? `${label}: ${text}` : text,
          }
        }
        if (m.role === 'user') return { role: 'user' as const, content: m.text }
        return { role: 'system' as const, content: m.text }
      })

      const prior = [...session.messages]
        .reverse()
        .find((m) => m.role === 'groupBeat')
      const priorAvoid = prior ? priorBeatAvoidText(activeBeatLines(prior)) : ''

      const messages = buildBeatMessages({
        speakers,
        allInChat: cast,
        historyApiMessages: historyApi,
        userName: persona?.name ?? 'User',
        userPersona: persona ? formatPersonaPromptBlock(persona) : '',
        memoryBlock: session.memorySummary
          ? `[Memory]\n${session.memorySummary}`
          : '',
        nudge,
        globalSystemPrompt: globals.system,
        postHistory: globals.postHistory,
        priorBeatToAvoid: priorAvoid,
      })

      const raw = await completeChat({
        apiKey,
        model,
        messages,
        useSubscription: await getUseSubscription(),
        temperature: Math.min(0.78, sampling.temperature),
        top_p: sampling.topP,
        max_tokens: Math.max(beatMaxTokens(speakers.length), sampling.maxTokens),
        frequency_penalty: Math.max(0.3, sampling.frequencyPenalty),
        presence_penalty: Math.max(0.15, sampling.presencePenalty),
      })

      const parsed = parseBeatReply(raw, speakers)
      if (parsed.length < 2) {
        setError('Group react returned too few lines. Try again.')
        return
      }
      const parts = linesToBeatParts(parsed)
      const flat = flattenBeat(parts)
      const msg: ChatMessage = {
        id: newId('msg'),
        role: 'groupBeat',
        text: flat,
        beatLines: parts,
        beatSwipes: [parts],
        swipes: encodeAllBeatSwipes([parts]),
        swipeIndex: 0,
        createdAt: new Date().toISOString(),
      }
      await persist({ ...session, messages: [...session.messages, msg] })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function postTimeline(role: 'narrator' | 'director', text: string) {
    if (!session) return
    const msg: ChatMessage = {
      id: newId('msg'),
      role,
      text,
      createdAt: new Date().toISOString(),
    }
    const next = { ...session, messages: [...session.messages, msg] }
    setSheet(null)
    await persist(next)
    if (role === 'narrator' && next.autoReply === true) {
      await runGeneration({ baseSession: next, target: 'new' })
    }
  }

  async function refreshPaths() {
    if (!session || !character) return
    const apiKey = await getApiKey()
    const model = await getChatModelId()
    if (!apiKey || !model) {
      setError('API key and default model required for Paths.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const options = await generatePaths({
        apiKey,
        model,
        messages: session.messages,
        direction: pathDirection,
        personaName: persona?.name,
        useSubscription: await getUseSubscription(),
      })
      setPathOptions(options)
      const anchor = session.messages[session.messages.length - 1]?.id
      await saveRoadwayCache({
        chatId,
        options,
        direction: pathDirection,
        anchorMessageId: anchor,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const composerHint = useMemo(() => {
    if (directorOn) return 'Direct the scene — how they act, feel, respond…'
    if (isGroup) return 'Message the group…'
    if (session?.autoReply === true && character) return `Message ${character.name}…`
    if (character) return `Send only — tap Continue for a reply`
    return 'Write as you…'
  }, [directorOn, session?.autoReply, character, isGroup])

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center text-[color:var(--color-muted)]">
        {error ?? 'Loading chat…'}
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }

  const menuMessage = menu
    ? session.messages.find((m) => m.id === menu.messageId)
    : undefined
  const menuIndex = menuMessage
    ? session.messages.findIndex((m) => m.id === menuMessage.id)
    : -1
  const isLastMessage = menuIndex === session.messages.length - 1
  const menuSwipeCount = menuMessage?.swipes?.length ?? 0
  const menuSwipeIdx = menuMessage?.swipeIndex ?? 0
  const isImpersonateMsg = menuMessage?.generationKind === 'impersonate'
  const canRewrite =
    menuMessage?.role === 'assistant' && !isImpersonateMsg
  const canRegenerate =
    menuMessage?.role === 'assistant' || isImpersonateMsg

  const noteSet = Boolean(session.authorsNote?.trim())
  const memorySet = Boolean(session.memorySummary?.trim())

  return (
    <div className="flex h-dvh w-full flex-col bg-[color:var(--color-bg)]">
      {/* App bar: Close · title · ⋮ */}
      <header className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-glass-border)] px-3 py-2.5">
        <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={onClose}>
          ✕ Close
        </button>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1
            className="truncate text-base font-semibold text-[color:var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {isGroup
              ? session.title ?? `Group chat (${cast.length})`
              : character?.name ?? session.title ?? 'Chat'}
          </h1>
          <p className="truncate text-xs text-[color:var(--color-muted)]">
            {isGroup
              ? `${cast.length} characters`
              : session.title && character
                ? session.title
                : persona
                  ? persona.name
                  : 'Solo'}
            {summarizing ? ' · summarizing…' : ''}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-lg leading-none"
            aria-label="Chat menu"
            onClick={() => setOverflowOpen((o) => !o)}
          >
            ⋮
          </button>
          {overflowOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Dismiss menu"
                onClick={() => setOverflowOpen(false)}
              />
              <div className="glass-panel absolute right-0 z-50 mt-1 max-h-[70vh] w-64 overflow-y-auto py-1 text-sm shadow-xl">
                <OverflowItem
                  label="API & connection"
                  onClick={() => {
                    setOverflowOpen(false)
                    onOpenApi()
                  }}
                />
                <div className="border-t border-white/5 px-3 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                    Persona
                  </p>
                  <select
                    className="field-input py-1.5 text-sm"
                    value={session.personaId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null
                      setPersona(personas.find((x) => x.id === id) ?? null)
                      void persist({ ...session, personaId: id })
                    }}
                  >
                    <option value="">No persona</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <OverflowItem
                  label="Author's Note"
                  onClick={() => {
                    setOverflowOpen(false)
                    setSheet('note')
                  }}
                />
                <OverflowItem
                  label={memorySet ? 'Memory summary (set)' : 'Memory summary'}
                  onClick={() => {
                    setOverflowOpen(false)
                    setSheet('memory')
                  }}
                />
                <OverflowItem
                  label="Summarize now"
                  onClick={() => {
                    setOverflowOpen(false)
                    void (async () => {
                      const apiKey = await getApiKey()
                      const model = await getChatModelId()
                      if (!apiKey || !model) {
                        setError('API key and model required to summarize.')
                        return
                      }
                      setSummarizing(true)
                      try {
                        const updated = await summarizeSessionMemory({
                          session,
                          apiKey,
                          model,
                          useSubscription: await getUseSubscription(),
                        })
                        await persist(updated)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err))
                      } finally {
                        setSummarizing(false)
                      }
                    })()
                  }}
                />
                <label className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-[color:var(--color-ink)]/85 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={session.autoReply === true}
                    onChange={(e) => void persist({ ...session, autoReply: e.target.checked })}
                  />
                  Auto-reply
                </label>
                {isGroup && onManageCast && (
                  <OverflowItem
                    label="Manage cast"
                    onClick={() => {
                      setOverflowOpen(false)
                      onManageCast()
                    }}
                  />
                )}
                <div className="my-1 border-t border-white/5" />
                <OverflowItem
                  label="Settings"
                  onClick={() => {
                    setOverflowOpen(false)
                    onOpenSettings()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {loreToast && (
        <div className="mx-3 mt-2 rounded-xl border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-deep)]/15 px-3 py-2 text-xs text-[color:var(--color-accent)]">
          {loreToast}
        </div>
      )}

      {/* Message list */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {session.messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[color:var(--color-muted)]">
            <p className="text-lg text-[color:var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Chat with {character?.name ?? 'character'}
            </p>
            <button type="button" className="btn-primary" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        )}
        {session.messages.map((m, index) => {
          const isUser = m.role === 'user'
          const isAssistant = m.role === 'assistant'
          const isBeat = m.role === 'groupBeat'
          const isTimeline = m.role === 'narrator' || m.role === 'director' || isBeat
          const beatLines = isBeat ? activeBeatLines(m) : []
          const text = isAssistant ? assistantText(m) : isBeat ? flattenBeat(beatLines) : m.text
          const isLastAssistant = index === lastAssistantIndex
          const swipeCount = isBeat
            ? m.beatSwipes?.length ?? m.swipes?.length ?? 0
            : m.swipes?.length ?? 0
          const isImpersonate = m.generationKind === 'impersonate'

          return (
            <div
              key={m.id}
              className={`flex ${isTimeline ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'}`}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ messageId: m.id })
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget
                const timer = window.setTimeout(() => setMenu({ messageId: m.id }), 480)
                const clear = () => window.clearTimeout(timer)
                t.addEventListener('touchend', clear, { once: true })
                t.addEventListener('touchmove', clear, { once: true })
              }}
            >
              <div
                className={`chat-bubble max-w-[min(92%,28rem)] px-3.5 py-2.5 text-sm leading-relaxed ${
                  isBeat
                    ? 'w-full max-w-md rounded-2xl border border-[color:var(--color-accent)]/25 bg-[color:var(--color-surface)]/80 text-left'
                    : isTimeline
                      ? m.role === 'director'
                        ? 'w-full max-w-md rounded-2xl border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-deep)]/10 text-center text-[color:var(--color-accent)]'
                        : 'w-full max-w-md rounded-2xl border border-white/15 bg-white/5 text-center text-[color:var(--color-ink)]/80'
                      : isUser
                        ? isImpersonate
                          ? 'rounded-2xl border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-deep)]/20 text-[color:var(--color-ink)]'
                          : 'rounded-2xl border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-deep)]/90 text-[color:var(--color-ink)]'
                        : 'glass-panel rounded-2xl text-[color:var(--color-ink)]/90'
                }`}
                style={{ borderRadius: 'var(--radius, 16px)' }}
                onClick={() => {
                  if (busy || isBeat) return
                  setEditingId(m.id)
                  setEditText(text)
                  setMenu(null)
                }}
              >
                {m.role === 'narrator' && (
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                    Narrator
                  </div>
                )}
                {m.role === 'director' && (
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-accent)]/70">
                    Director
                  </div>
                )}
                {isBeat && (
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-[color:var(--color-accent)]/70">
                    Group react
                  </div>
                )}
                {isAssistant && m.speakerName && isGroup && (
                  <div className="mb-1 text-[10px] font-semibold tracking-wide text-[color:var(--color-accent)]/80">
                    {m.speakerName}
                  </div>
                )}
                {isImpersonate && (
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-accent)]/70">
                    My line (AI)
                  </div>
                )}
                {isBeat ? (
                  <div className="space-y-2">
                    {beatLines.map((line, i) => (
                      <div key={`${line.speakerId}-${i}`}>
                        <div className="text-[11px] font-semibold text-[color:var(--color-accent)]">
                          {line.speakerName}
                        </div>
                        <RpText text={line.text} isUser={false} />
                      </div>
                    ))}
                  </div>
                ) : editingId === m.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="field-input min-h-[5rem] text-sm"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary px-3 py-1 text-xs"
                        onClick={async () => {
                          const messages = session.messages.map((msg) =>
                            msg.id === editingId
                              ? msg.role === 'assistant'
                                ? withAssistantText(msg, editText)
                                : { ...msg, text: editText }
                              : msg,
                          )
                          setEditingId(null)
                          await persist({ ...session, messages })
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <RpText text={text || (busy && isLastAssistant ? '…' : '')} isUser={isUser} />
                )}

                {isAssistant && swipeCount > 0 && !isBeat && (
                  <div
                    className="mt-2 flex items-center gap-2 text-xs text-[color:var(--color-muted)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={busy || (m.swipeIndex ?? 0) <= 0}
                      className="disabled:opacity-30"
                      onClick={async () => {
                        const swipes = m.swipes?.length ? m.swipes : [m.text]
                        const idx = m.swipeIndex ?? 0
                        const nextIdx = Math.max(0, idx - 1)
                        if (nextIdx === idx) return
                        const messages = [...session.messages]
                        messages[index] = {
                          ...m,
                          swipeIndex: nextIdx,
                          text: swipes[nextIdx] ?? m.text,
                        }
                        await persist({ ...session, messages })
                      }}
                    >
                      ◀
                    </button>
                    <span>
                      {(m.swipeIndex ?? 0) + 1}/{swipeCount}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      className="disabled:opacity-30"
                      onClick={async () => {
                        const swipes = m.swipes?.length ? m.swipes : [m.text]
                        const idx = m.swipeIndex ?? 0
                        if (isLastAssistant && idx >= swipes.length - 1) {
                          void runGeneration({ baseSession: session, target: 'swipe' })
                          return
                        }
                        const nextIdx = Math.min(swipes.length - 1, idx + 1)
                        if (nextIdx === idx) return
                        const messages = [...session.messages]
                        messages[index] = {
                          ...m,
                          swipeIndex: nextIdx,
                          text: swipes[nextIdx] ?? m.text,
                        }
                        await persist({ ...session, messages })
                      }}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error above composer */}
      {error && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-[color:var(--color-error)]/35 bg-[color:var(--color-error)]/10 px-3 py-2 text-sm text-[color:var(--color-error)]">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            className="shrink-0 text-xs opacity-80 hover:opacity-100"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Composer chrome */}
      <div className="shrink-0 space-y-2 border-t border-[color:var(--color-glass-border)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {(noteSet || memorySet) && (
          <div className="flex flex-wrap gap-2">
            {noteSet && (
              <button type="button" className="chip chip-selected" onClick={() => setSheet('note')}>
                Note
              </button>
            )}
          </div>
        )}

        {!directorOn && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="chip chip-selected"
              onClick={() => undefined}
              onContextMenu={(e) => {
                e.preventDefault()
                setSheet('you')
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget
                const timer = window.setTimeout(() => setSheet('you'), 480)
                const clear = () => window.clearTimeout(timer)
                t.addEventListener('touchend', clear, { once: true })
                t.addEventListener('touchmove', clear, { once: true })
              }}
            >
              You
            </button>
            {(isGroup ? cast : character ? [character] : []).map((c) => {
              const selected =
                isGroup &&
                session.autoReply === true &&
                cast[(session.nextSpeakerIndex ?? 0) % cast.length]?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className={selected ? 'chip chip-selected' : 'chip'}
                  disabled={busy}
                  onClick={() => {
                    if (!session || busy) return
                    if (isGroup) {
                      const idx = cast.findIndex((x) => x.id === c.id)
                      if (idx >= 0) {
                        void persist({ ...session, nextSpeakerIndex: idx })
                      }
                      if (session.autoReply !== true) {
                        void runGeneration({
                          baseSession: session,
                          target: 'new',
                          speaker: c,
                        })
                      }
                    }
                  }}
                >
                  {c.name}
                </button>
              )
            })}
            {isGroup && cast.length >= 2 && (
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => setSheet('groupReact')}
              >
                Group react
              </button>
            )}
          </div>
        )}

        {!isDesktop && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={directorOn ? 'btn-tonal w-full' : 'btn-outline w-full'}
              disabled={busy}
              onClick={() => {
                if (directorOn) {
                  setDirectorOn(false)
                  return
                }
                setDirectorOn(true)
              }}
            >
              {directorOn ? 'Director on' : 'Director'}
            </button>
            <button
              type="button"
              className="btn-tonal w-full"
              disabled={busy}
              onClick={() => void handleContinue()}
            >
              Continue
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {!isDesktop && (
            <button
              type="button"
              className="btn-ghost shrink-0 px-2 py-2 text-xl"
              aria-label="Composer tools"
              disabled={busy}
              onClick={() => setSheet('tools')}
            >
              +
            </button>
          )}
          {isDesktop && (
            <>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-2 text-xs"
                disabled={busy}
                onClick={() => setSheet('note')}
                title="Author's Note / Moods"
              >
                Mood
              </button>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-2 text-xs"
                disabled={busy}
                onClick={() => setSheet('narrator')}
              >
                Narrator
              </button>
              <button
                type="button"
                className={
                  directorOn
                    ? 'btn-tonal shrink-0 px-2 py-2 text-xs'
                    : 'btn-ghost shrink-0 px-2 py-2 text-xs'
                }
                disabled={busy}
                onClick={() => setDirectorOn((d) => !d)}
              >
                Director
              </button>
            </>
          )}
          <textarea
            className={`field-input min-h-[2.75rem] flex-1 resize-none ${
              directorOn ? 'border-[color:var(--color-accent)]!' : ''
            }`}
            rows={2}
            placeholder={composerHint}
            value={draft}
            disabled={busy}
            onChange={(e) => queueDraftSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && isDesktop) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          {isDesktop && (
            <button
              type="button"
              className="btn-tonal shrink-0 self-end px-3 py-2"
              disabled={busy}
              onClick={() => void handleContinue()}
              title="Continue"
            >
              ▶
            </button>
          )}
          {busy ? (
            <button
              type="button"
              className="shrink-0 self-end rounded-xl bg-[color:var(--color-error)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary shrink-0 self-end"
              onClick={() => void handleSend()}
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Message actions sheet */}
      {menu && menuMessage && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setMenu(null)}
        >
          <div
            className="glass-panel max-h-[55vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-2 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <MenuButton
              label="Delete"
              subtitle="Remove only this message"
              onClick={async () => {
                const messages = session.messages.filter((m) => m.id !== menu.messageId)
                setMenu(null)
                await persist({ ...session, messages })
              }}
            />
            <MenuButton
              label="Rewind to here"
              subtitle={
                isLastMessage
                  ? 'Already the last message'
                  : 'Delete every message after this one'
              }
              disabled={isLastMessage}
              onClick={async () => {
                setMenu(null)
                await persist(rewindToMessage(session, menu.messageId))
              }}
            />
            {canRegenerate && (
              <MenuButton
                label={isImpersonateMsg ? 'Regenerate my line' : 'Regenerate'}
                subtitle="Generate again"
                onClick={() => {
                  setMenu(null)
                  if (isImpersonateMsg) {
                    void runGeneration({
                      baseSession: session,
                      mode: 'impersonate',
                      target: 'replace',
                      generationKind: 'impersonate',
                      playerGuideNote: menuMessage.generationGuide,
                    })
                  } else {
                    void runGeneration({ baseSession: session, target: 'replace' })
                  }
                }}
              />
            )}
            {canRewrite && (
              <MenuButton
                label="Rewrite reply…"
                subtitle="Shorten, expand, change mood, or custom"
                onClick={() => {
                  setMenu(null)
                  setSheet('rewrite')
                }}
              />
            )}
            <div className="my-1 border-t border-white/5" />
            <MenuButton
              label="Branch from here"
              subtitle="New chat with history up to this message"
              onClick={async () => {
                setMenu(null)
                const branched = await branchFromMessage(session, menu.messageId)
                onBranched(branched.id)
              }}
            />
            {menuMessage.role === 'assistant' && menuSwipeCount >= 2 && (
              <>
                <MenuButton
                  label="Previous swipe"
                  disabled={menuSwipeIdx <= 0}
                  onClick={async () => {
                    const nextIdx = Math.max(0, menuSwipeIdx - 1)
                    const swipes = menuMessage.swipes ?? [menuMessage.text]
                    const messages = session.messages.map((m) =>
                      m.id === menuMessage.id
                        ? { ...m, swipeIndex: nextIdx, text: swipes[nextIdx] ?? m.text }
                        : m,
                    )
                    setMenu(null)
                    await persist({ ...session, messages })
                  }}
                />
                <MenuButton
                  label="Next swipe"
                  disabled={menuSwipeIdx >= menuSwipeCount - 1}
                  onClick={async () => {
                    const nextIdx = Math.min(menuSwipeCount - 1, menuSwipeIdx + 1)
                    const swipes = menuMessage.swipes ?? [menuMessage.text]
                    const messages = session.messages.map((m) =>
                      m.id === menuMessage.id
                        ? { ...m, swipeIndex: nextIdx, text: swipes[nextIdx] ?? m.text }
                        : m,
                    )
                    setMenu(null)
                    await persist({ ...session, messages })
                  }}
                />
              </>
            )}
            <MenuButton
              label="Paths"
              subtitle="Brainstorm what you could do or say next"
              onClick={() => {
                setMenu(null)
                setSheet('paths')
              }}
            />
          </div>
        </div>
      )}

      {/* You chip long-press */}
      {sheet === 'you' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setSheet(null)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-t-2xl p-2 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <p className="px-3 pb-1 text-xs text-[color:var(--color-muted)]">You</p>
            <MenuButton
              label="Impersonate"
              subtitle="AI writes your next line"
              onClick={() => {
                setSheet(null)
                void runGeneration({
                  baseSession: session,
                  mode: 'impersonate',
                  target: 'impersonate',
                  generationKind: 'impersonate',
                })
              }}
            />
            <MenuButton
              label="My line…"
              subtitle="Guide what you say or do"
              onClick={() => setSheet('myline')}
            />
          </div>
        </div>
      )}

      {sheet === 'tools' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3"
          onClick={() => setSheet(null)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-t-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
            <p className="px-3 pb-2 text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>
              Composer tools
            </p>
            <MenuButton
              label="Scene moods"
              onClick={() => {
                setSheet('note')
              }}
            />
            <MenuButton
              label="Narrator"
              onClick={() => setSheet('narrator')}
            />
            {isGroup && cast.length >= 2 && (
              <MenuButton
                label="Group react"
                onClick={() => setSheet('groupReact')}
              />
            )}
          </div>
        </div>
      )}

      {sheet === 'groupReact' && (
        <GroupReactSheet
          cast={cast}
          busy={busy}
          onClose={() => setSheet(null)}
          onGenerate={(ids, nudge) => void runGroupReact(ids, nudge)}
        />
      )}

      {sheet === 'narrator' && character && (
        <NarratorSheet
          busy={busy}
          onClose={() => setSheet(null)}
          onGenerate={async (nudge) => {
            const apiKey = await getApiKey()
            const model = await getChatModelId()
            if (!apiKey || !model) throw new Error('API key and model required.')
            return generateNarratorLine({
              apiKey,
              model,
              messages: session.messages,
              characterName: character.name,
              personaName: persona?.name,
              nudge,
              useSubscription: await getUseSubscription(),
            })
          }}
          onPost={(text) => void postTimeline('narrator', text)}
        />
      )}
      {sheet === 'director' && (
        <DirectorSheet onClose={() => setSheet(null)} onPost={(text) => void postTimeline('director', text)} />
      )}
      {sheet === 'myline' && (
        <MyLineSheet
          onClose={() => setSheet(null)}
          onWrite={(guide) => {
            setSheet(null)
            void runGeneration({
              baseSession: session,
              mode: 'impersonate',
              target: 'impersonate',
              playerGuideNote: guide ?? undefined,
              generationKind: 'impersonate',
            })
          }}
        />
      )}
      {sheet === 'paths' && (
        <PathsSheet
          options={pathOptions}
          direction={pathDirection}
          busy={busy}
          onClose={() => setSheet(null)}
          onDirection={setPathDirection}
          onRefresh={() => void refreshPaths()}
          onUse={(text) => {
            queueDraftSave(text)
            setSheet(null)
          }}
          onCombine={(selected) => {
            void (async () => {
              const apiKey = await getApiKey()
              const model = await getChatModelId()
              if (!apiKey || !model) return
              setBusy(true)
              try {
                const merged = await combinePaths({
                  apiKey,
                  model,
                  selected,
                  useSubscription: await getUseSubscription(),
                })
                queueDraftSave(merged)
                setSheet(null)
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              } finally {
                setBusy(false)
              }
            })()
          }}
        />
      )}
      {sheet === 'rewrite' && lastAssistantIndex >= 0 && (
        <RewriteSheet
          onClose={() => setSheet(null)}
          onRewrite={(mode, custom) => {
            setSheet(null)
            const current = session.messages[lastAssistantIndex]!
            void runGeneration({
              baseSession: session,
              target: 'replace',
              rewrite: {
                mode,
                currentReply: assistantText(current),
                customInstruction: custom,
              },
            })
          }}
        />
      )}
      {sheet === 'memory' && (
        <MemorySheet
          summary={session.memorySummary ?? ''}
          coveredCount={session.memoryCoveredCount ?? 0}
          messageCount={session.messages.length}
          autoEvery={autoEvery}
          busy={summarizing || busy}
          onClose={() => setSheet(null)}
          onSave={(summary, every) => {
            void (async () => {
              await setAutoSummarizeEvery(every)
              setAutoEvery(every)
              await persist({ ...session, memorySummary: summary })
              setSheet(null)
            })()
          }}
          onSummarizeNow={() => {
            void (async () => {
              const apiKey = await getApiKey()
              const model = await getChatModelId()
              if (!apiKey || !model) {
                setError('API key and model required to summarize.')
                return
              }
              setSummarizing(true)
              try {
                const updated = await summarizeSessionMemory({
                  session,
                  apiKey,
                  model,
                  useSubscription: await getUseSubscription(),
                })
                await persist(updated)
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              } finally {
                setSummarizing(false)
              }
            })()
          }}
        />
      )}
      {sheet === 'note' && (
        <AuthorsNoteSheet
          value={session.authorsNote ?? ''}
          onClose={() => setSheet(null)}
          onSave={(note) => {
            void persist({ ...session, authorsNote: note })
            setSheet(null)
          }}
        />
      )}
    </div>
  )
}

function OverflowItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full px-4 py-2.5 text-left text-[color:var(--color-ink)]/85 hover:bg-white/5"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function MenuButton({
  label,
  subtitle,
  onClick,
  disabled,
}: {
  label: string
  subtitle?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="block w-full px-4 py-2.5 text-left disabled:opacity-40"
      onClick={onClick}
    >
      <span className="block text-sm text-[color:var(--color-ink)]/90">{label}</span>
      {subtitle && (
        <span className="mt-0.5 block text-xs text-[color:var(--color-muted)]">{subtitle}</span>
      )}
    </button>
  )
}
