import { createVerify } from 'crypto'

export const NOAH_ENVIRONMENTS = ['sandbox', 'production'] as const

export type NoahEnvironment = (typeof NOAH_ENVIRONMENTS)[number]

export const isNoahEnvironment = (value: string): value is NoahEnvironment =>
  NOAH_ENVIRONMENTS.includes(value as NoahEnvironment)

export const verifyNoahWebhookSignature = (
  requestBody: Buffer,
  signatureHeader: string,
  publicKey: string,
): boolean => {
  try {
    const verifier = createVerify('SHA384')
    verifier.update(new Uint8Array(requestBody))
    verifier.end()
    return verifier.verify(publicKey, signatureHeader, 'base64')
  } catch {
    return false
  }
}
