import { PrismaClient, User } from '@prisma/client'
import { isAddress } from 'ethers/lib/utils'
import { Request, Response } from 'express'

import {
  CUSTODIAN_API_KEY,
  PRE_SIGN_ALERT_WEBHOOK_EVENT_TYPES,
} from '../config'
import PortalApi from '../libs/PortalApi'
import {
  EntityNotFoundError,
  HttpError,
  MissingParameterError,
} from '../libs/errors'
import { logger } from '../libs/logger'
import { isValidISO8601 } from '../libs/utils'

interface ExchangeService {
  getBalance: (chainId: number) => Promise<string>
  sendTransaction: (
    to: string,
    amount: number,
    chainId: number,
  ) => Promise<string | void>
  address: string
}

class MobileService {
  // private walletService: WalletService
  private portalApi: PortalApi
  constructor(
    private prisma: PrismaClient,
    private exchangeService: ExchangeService,
  ) {
    // this.walletService = new WalletService(this.prisma)
    this.portalApi = new PortalApi(CUSTODIAN_API_KEY)
  }

  /*
   * Authenticates a mobile user.
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      let { username, isAccountAbstracted } = req.body as {
        username: string
        isAccountAbstracted: boolean
      }
      if (!username || username === '') {
        throw new MissingParameterError('username')
      }

      username = String(username)
      isAccountAbstracted = Boolean(isAccountAbstracted)

      logger.info(`Attempting to login user: ${username}`)

      let user = await this.getUserByUsername(username).catch((error) => {
        if (error instanceof EntityNotFoundError) {
          logger.error(`Failed login for user ${username}`)
          res
            .status(401)
            .json({ message: `Could not find a user with ${username}` })
          return null
        } else {
          throw error
        }
      })

      if (!user) return

      if (!user.clientApiKey) {
        // const wallet = await this.walletService.createWallet()
        const portalClient = await this.portalApi.getClientApiKey(
          user.username,
          isAccountAbstracted,
        )
        user = await this.prisma.user.update({
          data: {
            clientApiKey: portalClient.clientApiKey,
            clientId: portalClient.id,
          },
          where: { id: user.id },
        })
        logger.info(`Created a new API key for ${username}`)
      }

      res.status(200).json({
        clientApiKey: user.clientApiKey,
        clientId: user.clientId,
        exchangeUserId: user.exchangeUserId,
        username: user.username,
      })
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   *
   * Creates a user, creates a wallet, requests a client api key, adds the client api to the db,
   *  sends INIT_AMOUNT from exchange to new portal wallet
   * Stores: exchangeUserId, pushToken, walletId, apiKey, apiSecret, address
   */
  async signUp(req: Request, res: Response): Promise<void> {
    try {
      let { username, isAccountAbstracted } = req.body as {
        username: string
        isAccountAbstracted: boolean
      }
      if (!username || username === '') {
        throw new MissingParameterError('username')
      }

      username = String(username)
      isAccountAbstracted = Boolean(isAccountAbstracted)

      const existingUser = await this.getUserByUsername(username).catch(
        (error) => {
          if (error instanceof EntityNotFoundError) {
            return null
          }
          throw error
        },
      )

      if (existingUser && existingUser.clientApiKey) {
        logger.info(`${username} already exists`)
        res.status(400).json({ message: `User already exists ${username}` })
        return
      }

      // idk why we have this exchangeUserId, but it needs to be a unique random number
      let attempt = 0
      const maxAttempts = 5
      let exchangeUserId = 0
      let userAlreadyExists = true

      while (userAlreadyExists) {
        if (attempt > maxAttempts) {
          throw new Error(
            'Failed to create user. Could not generate unique id. Try again.',
          )
        }

        exchangeUserId = Math.floor(Math.random() * 100000000)
        logger.info(
          `Attempting to create user with exchangeUserId: ${exchangeUserId}`,
        )
        await this.getUserByExchangeId(exchangeUserId).catch((error) => {
          if (error instanceof EntityNotFoundError) {
            userAlreadyExists = false
          }
        })
        attempt++
      }

      logger.info(`Calling portal to create a client api key`)
      const portalClient = await this.portalApi.getClientApiKey(
        username,
        isAccountAbstracted,
      )
      const user = await this.prisma.user.create({
        data: {
          exchangeUserId,
          username,
          clientApiKey: portalClient.clientApiKey,
          clientId: portalClient.id,
        },
      })

      logger.info(`Successfully signed up ${exchangeUserId}`)
      res.status(200).json({
        clientApiKey: user.clientApiKey,
        clientId: user.clientId,
        exchangeUserId: user.exchangeUserId,
        username: user.username,
      })
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      logger.error(error)
      res.status(500).json({ message: error.message })
    }
  }

  async createUser(username: string, isAccountAbstracted: boolean) {
    const exchangeUserId = Math.floor(Math.random() * 100000000)
    const existingExchangeUser = await this.getUserByExchangeId(
      exchangeUserId,
    ).catch((error) => {
      if (error instanceof EntityNotFoundError) {
        return null
      }
      throw error
    })

    if (existingExchangeUser) {
      throw new Error('user already exists with user id, try again')
    }

    logger.info(`Calling wallet service to create wallet`)
    const portalClient = await this.portalApi.getClientApiKey(
      username,
      isAccountAbstracted,
    )
    const user = await this.prisma.user.create({
      data: {
        exchangeUserId,
        username,
        clientApiKey: portalClient.clientApiKey,
        clientId: portalClient.id,
      },
    })

    return user
  }

  async enableEject(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)

      if (!user.clientApiKey) {
        throw new Error('User does not have a client api key')
      }

      const walletId = req.body['walletId'] as string
      if (!walletId) {
        throw new MissingParameterError('walletId')
      }

      const enableEjectResponse = await this.portalApi.enableEject(
        user.clientId,
        walletId,
      )

      res.status(200).send(enableEjectResponse)
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      logger.error(error)
      res.status(500).json({ message: error.message })
    }
  }

  async deprecated_enableEject(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)

      if (!user.clientApiKey) {
        throw new Error('User does not have a client api key')
      }

      const walletId = req.body['walletId'] as string
      if (!walletId) {
        throw new MissingParameterError('walletId')
      }

      const enableEjectResponse = await this.portalApi.deprecated_enableEject(
        user.clientId,
        walletId,
      )

      res.status(200).send(enableEjectResponse)
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      logger.error(error)
      res.status(500).json({ message: error.message })
    }
  }

  /*
   * Sends the walletId for an exchangeUserId
   */
  async sendWalletId(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)
      const walletId = user.walletId
      logger.info(`Successfully sent walletId for ${user.exchangeUserId}`)
      res.status(200).json({ walletId })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Store the client backup share for a user.
   */
  async storeClientBackupShare(req: Request, res: Response): Promise<void> {
    try {
      const backupMethod = req.body['backupMethod'] || 'UNKNOWN'
      const backupSharePairId = req.body['backupSharePairId'] || null
      const cipherText = String(req.body['cipherText'])
      const exchangeUserId = Number(req.params['exchangeUserId'])

      const user = await this.getUserByExchangeId(exchangeUserId)

      if (!cipherText) {
        throw new Error('Client did not send the cipher text')
      }

      // Delete any client backup shares that already exists with the same backupMethod, backupSharePairId, and userId.
      await this.prisma.clientBackupShare.deleteMany({
        where: {
          backupMethod,
          backupSharePairId,
          userId: user.id,
        },
      })

      // Store the client backup share.
      await this.prisma.clientBackupShare.create({
        data: {
          backupMethod,
          backupSharePairId,
          cipherText,
          userId: user.id,
        },
      })

      logger.info(
        `Successfully stored client backup share for user ${exchangeUserId} with backupMethod ${backupMethod} and backupSharePairId ${backupSharePairId}`,
      )
      res
        .status(200)
        .json({ message: 'Successfully stored client backup share' })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the client backup share for a user.
   */
  async getClientBackupShare(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const backupMethod = req.query.backupMethod || 'UNKNOWN'
      const backupSharePairId = req.query.backupSharePairId

      const user = await this.getUserByExchangeId(exchangeUserId)

      // Attempt to find the client backup share by backupSharePairId or by backup method as a fallback.
      const clientBackupShare = user.clientBackupShares?.find(
        (clientBackupShare) =>
          backupSharePairId
            ? clientBackupShare.backupSharePairId === backupSharePairId
            : clientBackupShare.backupMethod === backupMethod,
      )

      // If client backup share was found, return the cipher text.
      if (clientBackupShare) {
        res.status(200).json({ cipherText: clientBackupShare?.cipherText })
        return
      }

      // If no client backup share was found, find the backup share with the legacy backup method.
      const legacyBackupShare = user.clientBackupShares.find(
        (clientBackupShare) => clientBackupShare.backupMethod === 'UNKNOWN',
      )

      // If a legacy backup share was found, return the cipher text.
      if (legacyBackupShare) {
        res.status(200).json({ cipherText: legacyBackupShare?.cipherText })
        return
      }

      // If no client backup share was found, return a 404.
      logger.error(
        `[getClientBackupShare] Could not find client backup share for user ${exchangeUserId} with backup method ${
          backupMethod as string
        }]`,
      )
      res.status(404).json({ message: 'Client backup share not found' })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Store the custodian backup share for a user.
   */
  async storeCustodianBackupShare(req: Request, res: Response): Promise<void> {
    try {
      // Obtain the clientId from the request body.
      const { clientId } = req.body as {
        clientId: string
      }
      let { backupSharePairId, backupMethod, share } = req.body as {
        backupSharePairId: string | null
        backupMethod: string
        share: string | Record<string, any>
      }
      if (!clientId) {
        logger.error('[storeCustodianBackupShare] Did not receive clientId')
        throw new Error('[storeCustodianBackupShare] Did not receive clientId')
      }
      logger.info(`Storing backup share for client ${clientId}`)

      // Ensure that backupSharePairId is a string or null, not undefined.
      backupSharePairId = backupSharePairId || null

      // Obtain the custodian backup share from the request body.
      share = String(share)
      if (!share) {
        logger.error('[storeCustodianBackupShare] Did not receive backup share')
        throw new Error(
          '[storeCustodianBackupShare] Did not receive backup share',
        )
      }

      backupMethod = backupMethod || 'UNKNOWN'
      if (typeof backupMethod !== 'string') {
        logger.error(
          '[storeCustodianBackupShare] Did not receive backup method as a string',
        )
        throw new Error(
          '[storeCustodianBackupShare] Did not receive backup method as a string',
        )
      }

      const user = await this.getUserByClientId(clientId)

      // Delete any custodian backup shares that already exists with the same backupMethod, backupSharePairId, and userId.
      await this.prisma.custodianBackupShare.deleteMany({
        where: {
          backupMethod,
          backupSharePairId,
          userId: user.id,
        },
      })

      // Store the custodian backup share.
      await this.prisma.custodianBackupShare.create({
        data: {
          backupMethod,
          backupSharePairId,
          share,
          userId: user.id,
        },
      })

      logger.info(`Successfully stored backup share for client ${clientId}`)
      res.status(200).json({ message: 'Successfully stored backup share' })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the custodian backup share for a user.
   */
  async getCustodianBackupShare(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const backupMethod = req.query.backupMethod || 'UNKNOWN'
      const backupSharePairId = req.query.backupSharePairId

      const user = await this.getUserByExchangeId(exchangeUserId)

      // Attempt to find the custodian backup share by backupSharePairId or by backup method as a fallback.
      const custodianBackupShare = user.custodianBackupShares?.find(
        (custodianBackupShare) =>
          backupSharePairId
            ? custodianBackupShare.backupSharePairId === backupSharePairId
            : custodianBackupShare.backupMethod === backupMethod,
      )

      // If custodian backup share was found, return the cipher text.
      if (custodianBackupShare) {
        res.status(200).json({ orgShare: custodianBackupShare?.share })
        return
      }

      // If no custodian backup share was found, find the backup share with the legacy backup method.
      const legacyBackupShare = user.custodianBackupShares.find(
        (custodianBackupShare) =>
          custodianBackupShare.backupMethod === 'UNKNOWN',
      )

      // If a legacy backup share was found, return the cipher text.
      if (legacyBackupShare) {
        res.status(200).json({ orgShare: legacyBackupShare?.share })
        return
      }

      // If no custodian backup share was found, return a 404.
      logger.error(
        `[getCustodianBackupShare] Could not find custodian backup share for user ${exchangeUserId} with backup method ${
          backupMethod as string
        }]`,
      )
      res.status(404).json({ message: 'Custodian backup share not found' })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the custodian backup shares for a user.
   */
  async getCustodianBackupShares(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.body as { clientId: string }
      if (!clientId) {
        logger.error('[getCustodianBackupShares] Did not receive clientId')
        throw new Error('[getCustodianBackupShares] Did not receive clientId')
      }

      const user = await this.getUserByClientId(clientId)

      // Obtain the custodian backup shares for the user.
      const backupShares = user.custodianBackupShares.map(
        (backupShare) => backupShare.share,
      )

      // Return the custodian backup shares for the user.
      logger.info(
        `Successfully responded with custodian backup shares for client ${clientId}`,
      )
      res.status(200).json({ backupShares })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Transfers an amount of eth from the exchange to the users wallet.
   */
  async transferFundsByExchangeUserId(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const amount = Number(req.body['amount'])
      const chainId = Number(req.body['chainId'])
      const address: string = req.body['address']

      const user = await this.getUserByExchangeId(exchangeUserId)

      logger.info(
        `[transferFundsByExchangeUserId] Transferring ${amount} ETH (Chain ID: ${chainId}) to ${address} (exchangeUserId: ${user.exchangeUserId})`,
      )
      const txHash = await this.transferExchangeFunds(address, amount, chainId)

      logger.info(
        `[transferFundsByExchangeUserId] Successfully submitted transfer for ${amount} ETH (Chain ID: ${chainId}) to ${address} (exchangeUserId: ${user.exchangeUserId})`,
      )
      res.status(200).json({ txHash })
    } catch (error) {
      logger.error(`[transferFundsByExchangeUserId] Error: ${error}`, {
        error,
      })
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Transfers an amount of test ETH from the exchange to the users wallet.
   */
  async fundAddressByChainId(req: Request, res: Response): Promise<void> {
    const SUPPORTED_CHAIN_IDS = ['eip155:11155111', 'eip155:84532']

    const { chainId, address } = req.params
    const { amount } = req.body as { amount: number }

    try {
      // Validate that the request body contains the required parameters
      if (!chainId || !address || !amount) {
        res.status(400).json({
          error: `Missing parameters: chainId: ${chainId}, address: ${address}, amount: ${amount}`,
        })
        return
      }

      // Validate that the chainId is supported
      if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
        res.status(400).json({ error: `Unsupported chainId: ${chainId}` })
        return
      }

      // Validate that the address is a valid ethereum address
      if (!isAddress(address)) {
        res.status(400).json({ error: `Invalid eip155 address: ${address}` })
        return
      }

      // Validate that the amount is between 0 and 0.05 (but greater than 0)
      if (amount <= 0 || amount > 0.05) {
        res.status(400).json({
          error: `Invalid amount: ${amount}, must be between 0 and 0.05`,
        })
        return
      }

      // Derive the chain reference id from the chainId
      const chainReferenceId = Number(chainId.split(':')[1])
      if (isNaN(chainReferenceId)) {
        res.status(400).json({ error: `Invalid chainId: ${chainId}` })
        return
      }

      logger.info(
        `[fundAddressByChainId] Funding ${amount} ETH (Chain ID: ${chainId}) to ${address}`,
      )

      // Transfer the funds to the address
      const txHash = await this.transferExchangeFunds(
        address,
        amount,
        chainReferenceId,
      )

      logger.info(
        `[fundAddressByChainId] Successfully submitted transfer for ${amount} ETH (Chain ID: ${chainId}) to ${address}`,
      )
      res.status(200).json({ txHash })
    } catch (error) {
      logger.error(
        `[fundAddressByChainId] Error funding wallet ${address} on chain ${chainId}: ${error}`,
        {
          error,
        },
      )
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the balance of an exchange account for an exchangeUserId
   */
  async getExchangeBalance(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId: number = Number(req.params['exchangeUserId'])

      if (!('chainId' in req.query)) {
        throw new Error('Chain id is required for getting the balance')
      }
      const chainId: number = Number(req.query['chainId'])

      const cache = await this.prisma.exchangeBalance.findFirst({
        where: { chainId },
      })
      let balance = cache?.cachedBalance?.toNumber()

      if (!balance) {
        const updatedBalance = await this.exchangeService.getBalance(chainId)
        await this.prisma.exchangeBalance.create({
          data: {
            cachedBalance: updatedBalance,
            chainId,
          },
        })
        balance = parseFloat(updatedBalance)
      }

      logger.info(
        `Successfully sent balance of ${balance} for user ${exchangeUserId}`,
      )

      res.status(200).json({ balance })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Force a refresh of the exchange balance, and return the new value
   */
  async refreshExchangeBalance(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const chainId = Number(req.body['chainId'])

      const updatedBalance = await this.exchangeService.getBalance(chainId)

      const cachedBalance = await this.prisma.exchangeBalance.findFirst({
        where: { chainId },
      })
      if (!cachedBalance) {
        await this.prisma.exchangeBalance.create({
          data: {
            cachedBalance: updatedBalance,
            chainId,
          },
        })
      } else {
        await this.prisma.exchangeBalance.update({
          where: {
            id: cachedBalance.id,
          },
          data: {
            cachedBalance: updatedBalance,
            chainId,
          },
        })
      }

      logger.info(
        `Successfully updated exchange balance of ${updatedBalance} for user ${exchangeUserId}`,
      )

      res.status(200).json({ balance: updatedBalance })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Sends the address of the portal wallet for an exchangeUserId
   */
  async sendAddress(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)
      const address = user.address

      logger.info(`Successfully sent address for user ${exchangeUserId}`)

      res.status(200).json({ address })
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Gets user by username
   */
  private async getUserByUsername(username: string): Promise<User> {
    logger.info(`Querying for user by username: ${username}`)

    const user = await this.prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      throw new EntityNotFoundError('User', username)
    }

    return user
  }

  /*
   * Gets user object based on exchangeUserId
   */
  private async getUserByExchangeId(exchangeUserId: number) {
    logger.info(
      `[getUserByExchangeId] Querying for user by exchangeUserId: ${exchangeUserId}`,
    )
    const user = await this.prisma.user.findUnique({
      where: { exchangeUserId },
      include: {
        clientBackupShares: true,
        custodianBackupShares: true,
      },
    })

    if (!user) {
      throw new EntityNotFoundError('User', String(exchangeUserId))
    }

    return user
  }

  /*
   * Gets user object based on clientApiKey
   */
  private async getUserByClientId(clientId: string) {
    logger.info(
      `[getUserByClientId] Querying for user by clientId: ${clientId}`,
    )
    const user = await this.prisma.user.findUnique({
      where: { clientId },
      include: {
        clientBackupShares: true,
        custodianBackupShares: true,
      },
    })

    if (!user) {
      throw new EntityNotFoundError('User', 'clientId')
    }

    return user
  }

  /*
   * Transfers an amount of funds from the omnibus to a specific "to" address.
   * Primarily used to send funds to the users connected portal wallet.
   */
  private async transferExchangeFunds(
    to: string,
    amount: number,
    chainId: number,
  ) {
    if (!isAddress(to)) {
      throw new Error(`Address ${to} is not a valid ethereum address.`)
    }

    const MAX_RETRIES = 10
    const RETRY_DELAY = 2000 // 2 second delay between retries, so 10 retries is 20 seconds total.

    // Check if the balance is sufficient
    const balance = await this.exchangeService.getBalance(chainId)
    if (amount >= 0 && Number(balance) < amount) {
      throw new Error(
        `Your balance of ${balance} is too low to transfer ${amount} ETH (Chain ID: ${chainId}) to your portal wallet`,
      )
    }

    // Try to send the transaction up to MAX_RETRIES times
    // (only if it's a replacement error from sending multiple transactions in parallel)
    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Send the transaction
        const txHash = await this.exchangeService.sendTransaction(
          to,
          amount,
          chainId,
        )
        logger.info(
          `[transferExchangeFunds] Transaction submitted on attempt ${attempt}, txHash: ${txHash}`,
        )
        return txHash
      } catch (error) {
        lastError = error as { message: string }

        // Check if the error is a replacement error.
        const isReplacementError =
          lastError?.message?.includes('REPLACEMENT_UNDERPRICED') ||
          lastError?.message?.includes('replacement transaction underpriced') ||
          lastError?.message?.includes('already known') ||
          lastError?.message?.includes('nonce has already been used')

        // If it's not a replacement error, don't retry and throw the error.
        if (!isReplacementError) {
          logger.error(
            `[transferExchangeFunds] Failed to send transaction, got error: ${lastError?.message}`,
            {
              lastError,
            },
          )
          throw error
        }

        // If it's a replacement error, retry after a delay.
        if (attempt < MAX_RETRIES) {
          logger.warn(
            `[transferExchangeFunds] Attempt ${attempt} / ${MAX_RETRIES} failed with replacement error, retrying after ${RETRY_DELAY}ms...`,
            {
              lastError,
            },
          )
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        }
      }
    }

    // If we've made it here, we've failed to send the transaction after MAX_RETRIES attempts.
    logger.error(
      `[transferExchangeFunds] Failed to send transaction after ${MAX_RETRIES} attempts`,
      {
        lastError,
      },
    )
    throw lastError
  }

  /*
   * Store an alert webhook event for a user
   */
  async storeAlertWebhookEvent(req: Request, res: Response): Promise<void> {
    try {
      const { data, metadata, type } = req.body as {
        data: any
        metadata: Record<string, any>
        type: string
      }

      logger.info(`[storeAlertWebhookEvent] Received alert webhook event`, {
        requestBody: req.body,
      })

      if (!data || !type) {
        throw new MissingParameterError('data or type')
      }

      const alertWebhookEvent = await this.prisma.alertWebhookEvent.create({
        data: {
          event: data,
          metadata,
          type,
        },
      })

      logger.info(
        `[storeAlertWebhookEvent] Successfully stored alert webhook event`,
        {
          alertWebhookEventId: alertWebhookEvent.id,
        },
      )

      // Handle pre-sign alert webhook event rejection + errors
      if (
        PRE_SIGN_ALERT_WEBHOOK_EVENT_TYPES.includes(type) &&
        data?.signingRequest?.method === 'personal_sign'
      ) {
        const errorMessage =
          '0x' + Buffer.from('e2e_error_signature').toString('hex')
        const rejectMessage =
          '0x' + Buffer.from('e2e_reject_signature').toString('hex')
        const messageToSign = data?.signingRequest?.params

        // Handle error requests
        if (
          typeof messageToSign === 'string' &&
          messageToSign?.includes(errorMessage)
        ) {
          res
            .status(418) // 🫖 "I'm a teapot" status code, since we want to ensure non-400 status codes are treated as errors in e2e tests.
            .json({
              message: 'Erroring pre-sign alert webhook request',
              got: messageToSign,
              expected: errorMessage,
            })
          return
        }

        // Handle reject requests
        if (
          typeof messageToSign === 'string' &&
          messageToSign?.includes(rejectMessage)
        ) {
          res.status(400).json({
            message: 'Rejecting pre-sign alert webhook request',
            got: messageToSign,
            expected: rejectMessage,
          })
          return
        }
      }

      res.status(200).send({ alertWebhookEvent })
    } catch (error) {
      logger.error(
        `[storeAlertWebhookEvent] Error storing alert webhook event`,
        {
          error,
        },
      )
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Simulate a failure of an alert webhook event
   */
  simulateAlertWebhookEventFailure(req: Request, res: Response): void {
    logger.info(
      `[simulateAlertWebhookEventFailure] Simulating alert webhook event failure`,
      {
        requestBody: req.body,
      },
    )
    res.status(400).json({ message: 'Simulated alert webhook event failure' })
  }

  /*
   * Get alert webhook event by id
   */
  async getAlertWebhookEvent(req: Request, res: Response): Promise<void> {
    try {
      const { alertWebhookEventId } = req.params

      logger.info(
        `[getAlertWebhookEvent] Received request for alert webhook event`,
        {
          alertWebhookEventId,
        },
      )

      if (!alertWebhookEventId) {
        throw new MissingParameterError('alertWebhookEventId')
      }

      const alertWebhookEvent = await this.prisma.alertWebhookEvent.findUnique({
        where: {
          id: alertWebhookEventId,
        },
      })

      logger.info(
        `[getAlertWebhookEvent] Successfully fetched alert webhook event`,
        {
          alertWebhookEvent,
        },
      )

      res.status(200).json({ alertWebhookEvent })
    } catch (error) {
      logger.error(
        `[getAlertWebhookEvent] Error fetching alert webhook event`,
        {
          error,
        },
      )
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get alert webhook events triggered by an address
   */
  async getAlertWebhookEventsByAddress(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { address } = req.params
      const since = req.query.since as string
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100 // Default to 100 if not specified

      logger.info(
        `[getAlertWebhookEventsByAddress] Received request for alert webhook events`,
        {
          address,
          since,
          limit,
        },
      )

      if (!address) {
        throw new MissingParameterError('address')
      }

      // Validate limit is a reasonable number
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        res.status(400).json({ message: '"limit" must be between 1 and 1000' })
        return
      }

      // Validate "since" is a valid ISO timestamp
      if (since && !isValidISO8601(since)) {
        res.status(400).json({
          message: 'Invalid ISO timestamp format for "since" parameter',
        })
        return
      }

      const whereClause: any = {
        event: {
          array_contains: [
            {
              metadata: {
                triggeredBy: address.toLowerCase(),
              },
            },
          ],
        },
      }

      if (since) {
        whereClause.createdAt = {
          gte: since,
        }
      }

      logger.info(`[getAlertWebhookEventsByAddress] Where clause`, {
        whereClause,
      })

      const alertWebhookEvents = await this.prisma.alertWebhookEvent.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })

      logger.info(
        `[getAlertWebhookEventsByAddress] Successfully fetched alert webhook events`,
        {
          count: alertWebhookEvents.length,
          since,
          limit,
        },
      )

      res.status(200).json({ alertWebhookEvents })
    } catch (error) {
      logger.error(
        `[getAlertWebhookEventsByAddress] Error fetching alert webhook events`,
        {
          error,
        },
      )
      res.status(500).json({ message: 'Internal server error' })
    }
  }
}

export default MobileService
