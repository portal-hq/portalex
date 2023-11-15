import { CUSTODIAN_API_KEY } from '../config'
import { isAddress } from 'ethers/lib/utils'
import { PrismaClient, User } from '@prisma/client'
import { Request, Response } from 'express'
import {
  EntityNotFoundError,
  HttpError,
  MissingParameterError,
} from '../libs/errors'
import PortalApi from '../libs/PortalApi'
import { Decimal } from '@prisma/client/runtime'

interface ExchangeService {
  getBalance: Function
  sendTransaction: Function
  address: string
}

class MobileService {
  // private walletService: WalletService
  private portalApi: PortalApi
  constructor(
    private prisma: PrismaClient,
    private exchangeService: ExchangeService
  ) {
    // this.walletService = new WalletService(this.prisma)
    this.portalApi = new PortalApi(CUSTODIAN_API_KEY)
  }

  /*
   * Authenticates a mobile user.
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      let { username, isAccountAbstracted } = req.body
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
          isAccountAbstracted
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
  async signUp(req: any, res: any): Promise<void> {
    try {
      let { username, isAccountAbstracted } = req.body
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
        }
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
            'Failed to create user. Could not generate unique id. Try again.'
          )
        }

        exchangeUserId = Math.floor(Math.random() * 100000000)
        console.info(
          `Attempting to create user with exchangeUserId: ${exchangeUserId}`
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
        isAccountAbstracted
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
      exchangeUserId
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
      isAccountAbstracted
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
  async sendWalletId(req: any, res: any): Promise<void> {
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
   * Store the cipher text in the portalEx database.
   */
  async storeCipherText(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)
      const cipherText = String(req.body['cipherText'])

      if (!cipherText) {
        throw new Error('Client did not send the cipher text')
      }

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          cipherText,
        },
      })
      res.status(200).json({ message: 'Successfully stored cipher text' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the cipher text from the portalEx database.
   */
  async getCipherText(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const user = await this.getUserByExchangeId(exchangeUserId)

      if (!user.cipherText) {
        throw new Error('User does not have a stored cipher text')
      }

      res.status(200).json({ cipherText: user.cipherText })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Store the backup Share in the portalEx database.
   */
  async storeBackupShare(req: any, res: any): Promise<void> {
    try {
      const clientId = req.body['clientId']
      const backupShare = String(req.body['share'])
      console.info(`Storing backup share for client ${clientId}`)

      if (!clientId) {
        console.error('[storeBackupShare] Did not receive clientId')
        throw new Error('[storeBackupShare] Did not receive clientId')
      }
      if (!backupShare) {
        console.error('[storeBackupShare] Did not receive backup share')
        throw new Error('[storeBackupShare] Did not receive backup share')
      }

      const user = await this.getUserByClientId(clientId)

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          backupShare,
        },
      })

      console.info(`Successfully stored backup share for client ${clientId}`)
      res
        .status(200)
        .json({ message: `Successfully stored backup share for client` })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Get the backup Share from the portalEx database.
   */
  async getBackupShare(req: any, res: any): Promise<void> {
    try {
      const clientId = req.body['clientId']
      if (!clientId) {
        console.error('[getBackupShare] Did not receive clientId')
        throw new Error('[getBackupShare] Did not receive clientId')
      }

      const user = await this.getUserByClientId(clientId)
      if (!user?.backupShare) {
        console.info(
          `User ${clientId} does not have a backup share stored in the database`
        )
        res.status(400).json({ message: 'User does not have a backup share' })
        return
      }

      console.info(
        `Successfully responded with backup share for client ${clientId}`
      )
      res.status(200).json({ backupShare: user.backupShare })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  /*
   * Transfers an amount of eth from the exchange to the users wallet.
   */
  async transferFunds(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const amount = Number(req.body['amount'])
      const chainId = Number(req.body['chainId'])
      const address = req.body['address']

      const user = await this.getUserByExchangeId(exchangeUserId)

      // if (!user.address) {
      //   throw new Error(`User ${exchangeUserId} does not have an address.`)
      // }

      console.log(
        `Transferring ${amount} ETH into ${address} (user: ${user.exchangeUserId})`
      )
      const txHash = await this.transferExchangeFunds(address, amount, chainId)

      console.info(
        `Successfully submitted transfer for ${amount} ETH into ${address} (user: ${user.exchangeUserId})`
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
  async getExchangeBalance(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])

      if (!('chainId' in req.query)) {
        throw new Error('Chain id is required for getting the balance')
      }
      const chainId = Number(req.query['chainId'])

      const cache = await this.prisma.exchangeBalance.findFirst({
        where: { chainId },
      })
      let balance = cache?.cachedBalance

      if (!balance) {
        const updatedBalance = await this.exchangeService.getBalance(chainId)
        await this.prisma.exchangeBalance.create({
          data: {
            cachedBalance: updatedBalance,
            chainId,
          },
        })
        balance = new Decimal(updatedBalance)
      }

      console.info(
        `Successfully sent balance of ${balance} for user ${exchangeUserId}`
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
  async refreshExchangeBalance(req: any, res: any): Promise<void> {
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
        `Successfully updated exchange balance of ${updatedBalance} for user ${exchangeUserId}`
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
  async sendAddress(req: any, res: any): Promise<void> {
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
    chainId: number
  ) {
    if (!isAddress(to)) {
      throw new Error(`Address ${to} is not a valid ethereum address.`)
    }

    const balance = this.exchangeService.getBalance(chainId)
    if (amount >= 0 && Number(balance) < amount) {
      throw new Error(
        `You're balance of ${balance} is too low to transfer ${amount} ETH to your portal wallet`
      )
    }

    return this.exchangeService
      .sendTransaction(to, amount, chainId)
      .then((txHash: string) => {
        console.info(`Transaction submitted, txHash: ${txHash}`)
        return txHash
      })
      .catch(console.error)
  }
}

export default MobileService
