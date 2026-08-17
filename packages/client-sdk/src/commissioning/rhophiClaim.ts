export const RHOPHI_CLAIM_SERVICE_UUID = '9a7d5210-8e21-4f41-a131-52484f504849'
export const RHOPHI_IDENTITY_UUID = '9a7d5211-8e21-4f41-a131-52484f504849'
export const RHOPHI_CHALLENGE_UUID = '9a7d5212-8e21-4f41-a131-52484f504849'
export const RHOPHI_RESPONSE_UUID = '9a7d5213-8e21-4f41-a131-52484f504849'
export const RHOPHI_STATE_UUID = '9a7d5214-8e21-4f41-a131-52484f504849'
export const RHOPHI_IDENTIFY_UUID = '9a7d5215-8e21-4f41-a131-52484f504849'
export const RHOPHI_CANCEL_UUID = '9a7d5216-8e21-4f41-a131-52484f504849'

export const RHOPHI_IDENTITY_SIZE = 36
export const RHOPHI_NONCE_SIZE = 16
export const RHOPHI_CHALLENGE_SIZE = 32
export const RHOPHI_PROOF_SIZE = 32
export const RHOPHI_CLAIM_ID_SIZE = 16

export interface RhophiClaimIdentity {
  protocolVersion: number
  productId: number
  claimId: Uint8Array
  nonce: Uint8Array
  flags: number
}

export function decodeRhophiIdentity(value: Uint8Array): RhophiClaimIdentity {
  if (value.length !== RHOPHI_IDENTITY_SIZE) throw new Error('Invalid Rhophi identity length')
  return {
    protocolVersion: value[0]!,
    productId: value[1]! | (value[2]! << 8),
    claimId: value.slice(3, 19),
    nonce: value.slice(19, 35),
    flags: value[35]!,
  }
}

export function buildClaimMessage(nonce: Uint8Array, challenge: Uint8Array, claimId: Uint8Array): Uint8Array {
  if (nonce.length !== RHOPHI_NONCE_SIZE) throw new Error('Invalid device nonce length')
  if (challenge.length !== RHOPHI_CHALLENGE_SIZE) throw new Error('Invalid claim challenge length')
  if (claimId.length !== RHOPHI_CLAIM_ID_SIZE) throw new Error('Invalid claim ID length')
  const message = new Uint8Array(RHOPHI_NONCE_SIZE + RHOPHI_CHALLENGE_SIZE + RHOPHI_CLAIM_ID_SIZE)
  message.set(nonce, 0)
  message.set(challenge, RHOPHI_NONCE_SIZE)
  message.set(claimId, RHOPHI_NONCE_SIZE + RHOPHI_CHALLENGE_SIZE)
  return message
}

export function encodeBase64Url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

export function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('Invalid base64url value')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}
