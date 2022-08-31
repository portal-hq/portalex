import { Request, Response, NextFunction } from 'express'
import {
  UnauthorizedError,
  WrongTokenFormatError
} from './errors'
import { PrismaClient, User } from '@prisma/client'
import { WEBHOOK_SECRET } from '../config'

const prisma = new PrismaClient()

/**
 * Middleware to verify the webhook request is authenticated
 *
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
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
