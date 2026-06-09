function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer as ArrayBuffer
}

export async function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBuffer(publicKey),
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['verify'],
    )
    const message = new TextEncoder().encode(timestamp + rawBody)
    return await crypto.subtle.verify('Ed25519', key, hexToBuffer(signature), message)
  } catch {
    return false
  }
}
