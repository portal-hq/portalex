import { type Prisma, PrismaClient } from '@prisma/client'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Logger } from 'winston'

import { isNoahEnvironment, verifyNoahWebhookSignature } from '../../libs/noah'

type NoahWebhookControllerDependencies = {
  prisma: PrismaClient
  logger: Logger
  webhookPublicKeySandbox: string
  webhookPublicKeyProduction: string
}

class NoahController {
  private prisma: PrismaClient
  private logger: Logger
  private webhookPublicKeySandbox: string
  private webhookPublicKeyProduction: string

  constructor({
    prisma,
    logger,
    webhookPublicKeySandbox,
    webhookPublicKeyProduction,
  }: NoahWebhookControllerDependencies) {
    this.prisma = prisma
    this.logger = logger
    this.webhookPublicKeySandbox = webhookPublicKeySandbox
    this.webhookPublicKeyProduction = webhookPublicKeyProduction
  }

  public ingestWebhook = async (req: Request, res: Response) => {
    const noahEnvironment = req.params.noahEnvironment
    if (!isNoahEnvironment(noahEnvironment)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message:
          'Invalid noahEnvironment. Expected one of: sandbox, production',
      })
    }

    const signatureHeader = req.headers['webhook-signature']
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader

    if (!signature) {
      this.logger.warn(
        '[noah.webhooks.ingest] Missing Webhook-Signature header',
        noahEnvironment,
      )
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: 'Unauthorized' })
    }

    if (!Buffer.isBuffer(req.body)) {
      this.logger.warn(
        '[noah.webhooks.ingest] Expected raw request body buffer',
        noahEnvironment,
      )
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'Invalid request body' })
    }

    const publicKey =
      noahEnvironment === 'production'
        ? this.webhookPublicKeyProduction
        : this.webhookPublicKeySandbox

    if (!verifyNoahWebhookSignature(req.body, signature, publicKey)) {
      this.logger.warn('[noah.webhooks.ingest] Invalid webhook signature', {
        noahEnvironment,
      })
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: 'Unauthorized' })
    }

    let payload: Prisma.InputJsonValue
    try {
      payload = JSON.parse(req.body.toString('utf8')) as Prisma.InputJsonValue
    } catch (error: unknown) {
      this.logger.warn(
        '[noah.webhooks.ingest] Failed to parse webhook payload',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          noahEnvironment,
        },
      )
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Invalid JSON payload',
      })
    }

    try {
      await this.prisma.noahWebhookEvent.create({
        data: {
          noahEnvironment,
          payload,
        },
      })
    } catch (error: unknown) {
      this.logger.error(
        '[noah.webhooks.ingest] Failed to persist webhook payload',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          noahEnvironment,
        },
      )
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Internal server error',
      })
    }

    return res.status(StatusCodes.NO_CONTENT).send()
  }
}

export default NoahController
