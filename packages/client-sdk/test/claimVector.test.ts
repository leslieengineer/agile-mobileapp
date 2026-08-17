import { describe, expect, it } from 'vitest'
import {
  buildClaimMessage,
  decodeBase64Url,
  decodeRhophiIdentity,
  encodeBase64Url,
} from '../src/commissioning/rhophiClaim.js'

const fromHex = (value: string) => Uint8Array.from(value.match(/../gu)!.map(byte => Number.parseInt(byte, 16)))
const toHex = (value: Uint8Array) => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('')

describe('Rhophi claim wire contract', () => {
  it('assembles the shared known-answer message in nonce/challenge/claim order', () => {
    const nonce = fromHex('202122232425262728292a2b2c2d2e2f')
    const challenge = fromHex('303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f')
    const claimId = fromHex('505152535455565758595a5b5c5d5e5f')
    expect(toHex(buildClaimMessage(nonce, challenge, claimId))).toBe(
      '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f',
    )
  })

  it('decodes the 36-byte little-endian identity and base64url fields', () => {
    const encoded = fromHex('013412505152535455565758595a5b5c5d5e5f202122232425262728292a2b2c2d2e2f03')
    const identity = decodeRhophiIdentity(encoded)
    expect(identity.protocolVersion).toBe(1)
    expect(identity.productId).toBe(0x1234)
    expect(toHex(identity.claimId)).toBe('505152535455565758595a5b5c5d5e5f')
    expect(toHex(identity.nonce)).toBe('202122232425262728292a2b2c2d2e2f')
    expect(identity.flags).toBe(3)
    expect(decodeBase64Url(encodeBase64Url(encoded))).toEqual(encoded)
  })

  it('rejects malformed field lengths', () => {
    expect(() => decodeRhophiIdentity(new Uint8Array(35))).toThrow('identity length')
    expect(() => buildClaimMessage(new Uint8Array(15), new Uint8Array(32), new Uint8Array(16))).toThrow('nonce length')
  })
})
