import { PrismaClient } from '@prisma/client'
import { createHash, timingSafeEqual } from 'crypto'
import { Request, Response, NextFunction } from 'express'

import { API_KEYS, WEBHOOK_SECRET, ALERT_WEBHOOK_SECRET } from '../config'
import { UnauthorizedError, WrongTokenFormatError } from './errors'

new PrismaClient()

/**
 * Compares a candidate against every accepted secret in constant time.
 * Hashing first gives both sides a fixed length, so the comparison never
 * leaks the secret's length, and the loop never exits early on a match.
 */
function matchesAnySecret(candidate: string, secrets: string[]): boolean {
  const candidateDigest = createHash('sha256').update(candidate).digest()

  return secrets.reduce((matched: boolean, secret: string) => {
    const secretDigest = createHash('sha256').update(secret).digest()
    return timingSafeEqual(candidateDigest, secretDigest) || matched
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
