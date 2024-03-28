import { PrismaClient, User } from '@prisma/client'
import { isAddress } from 'ethers/lib/utils'
import { Request, Response } from 'express'

import { CUSTODIAN_API_KEY } from '../config'
import PortalApi from '../libs/PortalApi'
import {
  EntityNotFoundError,
  HttpError,
  MissingParameterError,
} from '../libs/errors'

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

      console.info(`Attempting to login user: ${username}`)

      let user = await this.getUserByUsername(username).catch((error) => {
        if (error instanceof EntityNotFoundError) {
          console.error(`Failed login for user ${username}`)
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
        console.info(`Created a new API key for ${username}`)
      }

      res.status(200).json({
        exchangeUserId: user.exchangeUserId,
        clientApiKey: user.clientApiKey,
      })
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      console.error(error)
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
        console.info(`${username} already exists`)
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
        console.info(
          `Attempting to create user with exchangeUserId: ${exchangeUserId}`,
        )
        await this.getUserByExchangeId(exchangeUserId).catch((error) => {
          if (error instanceof EntityNotFoundError) {
            userAlreadyExists = false
          }
        })
        attempt++
      }

      console.info(`Calling portal to create a client api key`)
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

      console.info(`Successfully signed up ${exchangeUserId}`)
      res.status(200).json({
        exchangeUserId: user.exchangeUserId,
        clientApiKey: user.clientApiKey,
      })
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.HttpStatus).json({ message: error.message })
        return
      }

      console.error(error)
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

    console.info(`Calling wallet service to create wallet`)
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

  /*
   * Sends the walletId for an exchangeUserId
   */
  async sendWalletId(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)
      const walletId = user.walletId
      console.info(`Successfully sent walletId for ${user.exchangeUserId}`)
      res.status(200).json({ walletId })
    } catch (error) {
      console.error(error)
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

      console.info(
        `Successfully stored client backup share for user ${exchangeUserId} with backupMethod ${backupMethod} and backupSharePairId ${backupSharePairId}`,
      )
      res
        .status(200)
        .json({ message: 'Successfully stored client backup share' })
    } catch (error) {
      console.error(error)
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
      console.error(
        `[getClientBackupShare] Could not find client backup share for user ${exchangeUserId} with backup method ${
          backupMethod as string
        }]`,
      )
      res.status(404).json({ message: 'Client backup share not found' })
    } catch (error) {
      console.error(error)
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
        console.error('[storeCustodianBackupShare] Did not receive clientId')
        throw new Error('[storeCustodianBackupShare] Did not receive clientId')
      }
      console.info(`Storing backup share for client ${clientId}`)

      // Ensure that backupSharePairId is a string or null, not undefined.
      backupSharePairId = backupSharePairId || null

      // Obtain the custodian backup share from the request body.
      share = String(share)
      if (!share) {
        console.error(
          '[storeCustodianBackupShare] Did not receive backup share',
        )
        throw new Error(
          '[storeCustodianBackupShare] Did not receive backup share',
        )
      }

      backupMethod = backupMethod || 'UNKNOWN'
      if (typeof backupMethod !== 'string') {
        console.error(
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

      console.info(`Successfully stored backup share for client ${clientId}`)
      res.status(200).json({ message: 'Successfully stored backup share' })
    } catch (error) {
      console.error(error)
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
      console.error(
        `[getCustodianBackupShare] Could not find custodian backup share for user ${exchangeUserId} with backup method ${
          backupMethod as string
        }]`,
      )
      res.status(404).json({ message: 'Custodian backup share not found' })
    } catch (error) {
      console.error(error)
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
        console.error('[getCustodianBackupShares] Did not receive clientId')
        throw new Error('[getCustodianBackupShares] Did not receive clientId')
      }

      const user = await this.getUserByClientId(clientId)

      // Obtain the custodian backup shares for the user.
      const backupShares = user.custodianBackupShares.map(
        (backupShare) => backupShare.share,
      )

      // Return the custodian backup shares for the user.
      console.info(
        `Successfully responded with custodian backup shares for client ${clientId}`,
      )
      res.status(200).json({ backupShares })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Transfers an amount of eth from the exchange to the users wallet.
   */
  async transferFunds(req: Request, res: Response): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const amount = Number(req.body['amount'])
      const chainId = Number(req.body['chainId'])
      const address: string = req.body['address']

      const user = await this.getUserByExchangeId(exchangeUserId)

      // if (!user.address) {
      //   throw new Error(`User ${exchangeUserId} does not have an address.`)
      // }

      console.log(
        `Transferring ${amount} ETH (Chain ID: ${chainId}) into ${address} (user: ${user.exchangeUserId})`,
      )
      const txHash = await this.transferExchangeFunds(address, amount, chainId)

      console.info(
        `Successfully submitted transfer for ${amount} ETH (Chain ID: ${chainId}) into ${address} (user: ${user.exchangeUserId})`,
      )
      res.status(200).json({ txHash })
    } catch (error) {
      console.error(error)
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

      console.info(
        `Successfully sent balance of ${balance} for user ${exchangeUserId}`,
      )

      res.status(200).json({ balance })
    } catch (error) {
      console.error(error)
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

      console.info(
        `Successfully updated exchange balance of ${updatedBalance} for user ${exchangeUserId}`,
      )

      res.status(200).json({ balance: updatedBalance })
    } catch (error) {
      console.error(error)
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

      console.info(`Successfully sent address for user ${exchangeUserId}`)

      res.status(200).json({ address })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Gets user by username
   */
  private async getUserByUsername(username: string): Promise<User> {
    console.info(`Querying for user by username: ${username}`)

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
    console.info(`Querying for userId: ${exchangeUserId}`)
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
    console.info(`Querying for userId: ${clientId}`)
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

    const balance = await this.exchangeService.getBalance(chainId)
    if (amount >= 0 && Number(balance) < amount) {
      throw new Error(
        `You're balance of ${balance} is too low to transfer ${amount} ETH (Chain ID: ${chainId}) to your portal wallet`,
      )
    }

    return this.exchangeService
      .sendTransaction(to, amount, chainId)
      .then((txHash) => {
        console.info(`Transaction submitted, txHash: ${txHash}`)
        return txHash
      })
      .catch(console.error)
  }
}

export default MobileService
