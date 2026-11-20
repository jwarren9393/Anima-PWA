/** RP rich text matching Flutter RpRichText: keep * and " visible. */

type Props = {
  text: string
  isUser?: boolean
  className?: string
}

export function RpText({ text, isUser = false, className = '' }: Props) {
  const parts: Array<{ type: 'action' | 'dialogue' | 'text'; value: string }> = []
  const re = /(\*[^*]+\*|“[^”]+”|"[^"]+")/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) })
    }
    const token = match[0]!
    if (token.startsWith('*')) {
      parts.push({ type: 'action', value: token })
    } else {
      parts.push({ type: 'dialogue', value: token })
    }
    last = match.index + token.length
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) })
  }

  return (
    <span className={`whitespace-pre-wrap break-words leading-[1.4] ${className}`}>
      {parts.map((p, i) => {
        if (p.type === 'action') {
          return (
            <em
              key={i}
              className="font-medium not-italic"
              style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}
            >
              {p.value}
            </em>
          )
        }
        if (p.type === 'dialogue') {
          return (
            <span
              key={i}
              className={isUser ? 'text-ink' : 'text-ink'}
              style={{ fontWeight: 600 }}
            >
              {p.value}
            </span>
          )
        }
        return (
          <span key={i} className="text-[color:var(--color-muted)]">
            {p.value}
          </span>
        )
      })}
    </span>
  )
}
