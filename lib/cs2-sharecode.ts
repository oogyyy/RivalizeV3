// CS2 match sharecode decoder.
// Alphabet is base-57 (excludes I, O, l, 0, 1, g to avoid visual ambiguity).
const ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789'

export interface DecodedSharecode {
  matchId: bigint
  reservationId: bigint
  tvPort: number
}

export function decodeMatchShareCode(sharecode: string): DecodedSharecode {
  const cleaned = sharecode.replace(/^CSGO-/, '').replace(/-/g, '')
  const reversed = cleaned.split('').reverse().join('')

  let value = BigInt(0)
  for (const char of reversed) {
    const idx = ALPHABET.indexOf(char)
    if (idx === -1) throw new Error(`Invalid sharecode character: ${char}`)
    value = value * BigInt(57) + BigInt(idx)
  }

  const bytes: number[] = []
  for (let i = 0; i < 18; i++) {
    bytes.push(Number(value & BigInt(0xff)))
    value >>= BigInt(8)
  }

  const toU64 = (b: number[]) =>
    BigInt('0x' + b.reverse().map(x => x.toString(16).padStart(2, '0')).join(''))

  return {
    matchId:       toU64(bytes.slice(0, 8)),
    reservationId: toU64(bytes.slice(8, 16)),
    tvPort:        bytes[16] | (bytes[17] << 8),
  }
}

export function validateSharecode(code: string): boolean {
  return /^CSGO(-[A-Za-z0-9]{5}){5}$/.test(code)
}

/** steam:// launch URL that opens CS2 and starts downloading the demo. */
export function sharecode_toSteamUrl(sharecode: string): string {
  return `steam://rungame/730/76561202255233023/+csgo_download_match%20${encodeURIComponent(sharecode)}`
}
