export function applyMacros(
  text: string,
  opts: { userName?: string; charName?: string; defaultSeed?: string },
): string {
  let out = text
  const user = opts.userName ?? 'User'
  const char = opts.charName ?? 'Character'
  out = out.replace(/\{\{user\}\}/gi, user).replace(/<USER>/gi, user)
  out = out.replace(/\{\{char\}\}/gi, char).replace(/<BOT>/gi, char)
  if (opts.defaultSeed) {
    out = out.replace(/\{\{original\}\}/gi, opts.defaultSeed)
  }
  return out
}
