/**
 * Minimal PNG tEXt chunk reader/writer for SillyTavern chara / ccv3 cards.
 */

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false)
}

function writeU32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, false)
  return b
}

/** CRC32 for PNG chunks */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

export type PngChunk = { type: string; data: Uint8Array }

export function parsePngChunks(bytes: Uint8Array): PngChunk[] {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) {
      throw new Error('Not a PNG file.')
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: PngChunk[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readU32(view, offset)
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    )
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) break
    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) })
    offset = dataEnd + 4
    if (type === 'IEND') break
  }
  return chunks
}

export function decodeTextChunk(data: Uint8Array): { keyword: string; text: string } {
  let sep = -1
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      sep = i
      break
    }
  }
  if (sep < 0) throw new Error('Invalid tEXt chunk.')
  const keyword = new TextDecoder().decode(data.subarray(0, sep))
  const text = new TextDecoder().decode(data.subarray(sep + 1))
  return { keyword, text }
}

export function encodeTextChunk(keyword: string, text: string): PngChunk {
  const keyBytes = new TextEncoder().encode(keyword)
  const textBytes = new TextEncoder().encode(text)
  const data = new Uint8Array(keyBytes.length + 1 + textBytes.length)
  data.set(keyBytes, 0)
  data[keyBytes.length] = 0
  data.set(textBytes, keyBytes.length + 1)
  return { type: 'tEXt', data }
}

export function encodePngChunks(chunks: PngChunk[]): Uint8Array {
  let total = 8
  for (const chunk of chunks) {
    total += 12 + chunk.data.length
  }
  const out = new Uint8Array(total)
  out.set(PNG_SIG, 0)
  let offset = 8
  for (const chunk of chunks) {
    const typeBytes = new TextEncoder().encode(chunk.type)
    const len = writeU32(chunk.data.length)
    out.set(len, offset)
    offset += 4
    out.set(typeBytes, offset)
    offset += 4
    out.set(chunk.data, offset)
    offset += chunk.data.length
    const crcBuf = new Uint8Array(4 + chunk.data.length)
    crcBuf.set(typeBytes, 0)
    crcBuf.set(chunk.data, 4)
    out.set(writeU32(crc32(crcBuf)), offset)
    offset += 4
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function readCharaJsonFromPng(bytes: Uint8Array): string {
  const chunks = parsePngChunks(bytes)
  const texts = chunks
    .filter((c) => c.type === 'tEXt')
    .map((c) => decodeTextChunk(c.data))
  const ccv3 = texts.find((t) => t.keyword.toLowerCase() === 'ccv3')
  if (ccv3) return base64ToUtf8(ccv3.text)
  const chara = texts.find((t) => t.keyword.toLowerCase() === 'chara')
  if (chara) return base64ToUtf8(chara.text)
  throw new Error('PNG has no SillyTavern character card metadata.')
}

export function writeCharaJsonIntoPng(pngBytes: Uint8Array, jsonText: string): Uint8Array {
  const chunks = parsePngChunks(pngBytes).filter((c) => {
    if (c.type !== 'tEXt') return true
    const { keyword } = decodeTextChunk(c.data)
    const k = keyword.toLowerCase()
    return k !== 'chara' && k !== 'ccv3'
  })

  const b64 = bytesToBase64(new TextEncoder().encode(jsonText))
  const charaChunk = encodeTextChunk('chara', b64)

  let v3Chunk: PngChunk | null = null
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const v3 = {
      ...parsed,
      spec: 'chara_card_v3',
      spec_version: '3.0',
    }
    v3Chunk = encodeTextChunk(
      'ccv3',
      bytesToBase64(new TextEncoder().encode(JSON.stringify(v3))),
    )
  } catch {
    v3Chunk = null
  }

  const iendIndex = chunks.findIndex((c) => c.type === 'IEND')
  const insertAt = iendIndex >= 0 ? iendIndex : chunks.length
  const next = [...chunks]
  next.splice(insertAt, 0, charaChunk)
  if (v3Chunk) next.splice(insertAt + 1, 0, v3Chunk)
  return encodePngChunks(next)
}

/** Tiny valid 1×1 dark PNG used when exporting JSON cards without an avatar image. */
export function minimalPngBytes(): Uint8Array {
  // Precomputed 1x1 RGBA PNG (#0a0a0e)
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
