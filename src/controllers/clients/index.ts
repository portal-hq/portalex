import { PrismaClient, User } from '@prisma/client'
import { randomInt } from 'crypto'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Logger } from 'winston'

import { MissingParameterError } from '../../libs/errors'

const EXCHANGE_USER_ID_MAX = 100000000
const MAX_CREATE_ATTEMPTS = 5

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MissingParameterError(name)
  }

  return value.trim()
}

/*
 * Prisma reports the violated constraint in meta.target, which is a string[] of
 * field names on some connectors and the index name on others. Flattening to a
 * single string lets one substring check cover both shapes.
 */
const uniqueViolationTarget = (error: unknown): string | null => {
  const candidate = error as { code?: unknown; meta?: { target?: unknown } }
  if (candidate?.code !== 'P2002') {
    return null
  }

  const target = candidate.meta?.target
  if (Array.isArray(target)) {
    return target.join(',')
  }

  return typeof target === 'string' ? target : ''
}

const formatUser = (user: User) => ({
  clientApiKey: user.clientApiKey,
  clientId: user.clientId,
  exchangeUserId: user.exchangeUserId,
  username: user.username,
})

type ClientsControllerDependencies = {
  prisma: PrismaClient
  logger: Logger
}

class ClientsController {
  private prisma: PrismaClient
  private logger: Logger

  constructor({ prisma, logger }: ClientsControllerDependencies) {
    this.prisma = prisma
    this.logger = logger
  }

  private replayRegistration = (
    res: Response,
    existing: User,
    username: string,
    message: string,
  ) => {
    if (existing.username !== username) {
      this.logger.warn(
        '[registerClient] Client is registered to a different username',
        { clientId: existing.clientId },
      )

      return res.status(StatusCodes.CONFLICT).json({
        message: `Client ${existing.clientId} is already registered to a different username`,
      })
    }

    this.logger.info(message, {
      clientId: existing.clientId,
      exchangeUserId: existing.exchangeUserId,
    })

    return res.status(StatusCodes.OK).json(formatUser(existing))
  }

  public registerClient = async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const clientId = requireString(body.clientId, 'clientId')
    const username = requireString(body.username, 'username')
    const isAccountAbstracted = Boolean(body.isAccountAbstracted)

    const existing = await this.prisma.user.findUnique({ where: { clientId } })
    if (existing) {
      return this.replayRegistration(
        res,
        existing,
        username,
        '[registerClient] Client is already registered',
      )
    }

    const usernameOwner = await this.prisma.user.findUnique({
      where: { username },
    })
    if (usernameOwner) {
      this.logger.warn('[registerClient] Username belongs to another client', {
        username,
        clientId,
        registeredClientId: usernameOwner.clientId,
      })

      return res.status(StatusCodes.CONFLICT).json({
        message: `Username ${username} is already registered to a different client`,
      })
    }

    for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
      const exchangeUserId = randomInt(1, EXCHANGE_USER_ID_MAX)

      try {
        const user = await this.prisma.user.create({
          data: { clientId, username, exchangeUserId, clientApiKey: null },
        })

        this.logger.info('[registerClient] Registered client', {
          clientId,
          exchangeUserId,
          isAccountAbstracted,
        })

        return res.status(StatusCodes.CREATED).json(formatUser(user))
      } catch (error: unknown) {
        const target = uniqueViolationTarget(error)
        if (target === null) {
          throw error
        }

        if (target.includes('exchangeUserId')) {
          this.logger.warn(
            '[registerClient] exchangeUserId collision, retrying',
            { clientId, attempt },
          )
          continue
        }

        // A concurrent registration of the same client won the race.
        if (target.includes('clientId')) {
          const raced = await this.prisma.user.findUnique({
            where: { clientId },
          })

          if (raced) {
            return this.replayRegistration(
              res,
              raced,
              username,
              '[registerClient] Client was registered concurrently',
            )
          }
        }

        this.logger.warn('[registerClient] Unique constraint violation', {
          clientId,
          target,
        })

        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: `Already registered: ${target}` })
      }
    }

    throw new Error(
      'Failed to register client. Could not generate a unique exchangeUserId.',
    )
  }
}

export default ClientsController
