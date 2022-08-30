import { Request, Response, NextFunction } from 'express'
import {
  UnauthorizedError,
  WrongTokenFormatError
} from './errors'
import { PrismaClient, User } from '@prisma/client'

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
  if (req.headers?.authorization?.split(' ')[0] !== 'Bearer') {
    throw new WrongTokenFormatError()
  }
  const value = req.headers.authorization?.split(' ')[1]

  // Check if webhook secret exists in the DB
  const webhookSecret = await prisma.webhook.findFirst({
    where: { secret: value },
  })

  if (!webhookSecret) {
    throw new UnauthorizedError()
  }

  next()
}
