import { PrismaClient } from '@prisma/client'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { Request, Response, NextFunction } from 'express'

import { API_KEYS, WEBHOOK_SECRET, ALERT_WEBHOOK_SECRET } from '../config'
import { UnauthorizedError, WrongTokenFormatError } from './errors'

new PrismaClient()

// Fresh per process, and never stored or sent anywhere. It only has to make
// the digests below unpredictable to a caller who is probing the comparison.
const comparisonKey = randomBytes(32)

/**
 * Reduces a value to a fixed 32 bytes for comparison. This is the double HMAC
 * pattern, not password storage. The digest exists so timingSafeEqual gets two
 * equal-length buffers, which keeps the secret's length out of the comparison.
 */
function comparisonDigest(value: string): Buffer {
  return createHmac('sha256', comparisonKey).update(value).digest()
}

/**
 * Compares a candidate against every accepted secret in constant time.
 * The loop never exits early, so a match position does not leak either.
 */
function matchesAnySecret(candidate: string, secrets: string[]): boolean {
  const candidateDigest = comparisonDigest(candidate)

  return secrets.reduce((matched: boolean, secret: string) => {
    return timingSafeEqual(candidateDigest, comparisonDigest(secret)) || matched
  }, false)
}

/**
 * Middleware to verify the request carries an accepted API key.
 * Mounted globally, so every route below it in server.ts requires the header.
 */
export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const providedKey = req.headers['x-api-key']

  // A duplicated header arrives as an array. Only a single string is valid.
  if (typeof providedKey !== 'string' || providedKey.length === 0) {
    throw new UnauthorizedError()
  }

  // An empty API_KEYS list matches nothing, so the service fails closed.
  if (!matchesAnySecret(providedKey, API_KEYS)) {
    throw new UnauthorizedError()
  }

  next()
}

/**
 * Middleware to verify the webhook request is authenticated
 *
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.headers['x-webhook-secret']) {
    throw new WrongTokenFormatError()
  }
  const value = req.headers['x-webhook-secret'] as string

  if (value !== WEBHOOK_SECRET) {
    throw new UnauthorizedError()
  }

  next()
}

/**
 * Middleware to verify the alert webhook request is authenticated
 */
export function alertWebhookMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.headers['x-webhook-secret']) {
    throw new WrongTokenFormatError()
  }
  const value = req.headers['x-webhook-secret'] as string

  if (value !== ALERT_WEBHOOK_SECRET) {
    throw new UnauthorizedError()
  }

  next()
}
