import { PrismaClient } from '@prisma/client'
import { Request, Response, NextFunction } from 'express'

import { WEBHOOK_SECRET } from '../config'
import { UnauthorizedError, WrongTokenFormatError } from './errors'

new PrismaClient()

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
