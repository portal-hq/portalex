import {
  CUSTODIAN_API_KEY,
  INIT_AMOUNT,
} from '../config'
import { isAddress } from 'ethers/lib/utils'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { PrismaClient, User } from '@prisma/client'
import { Request, Response } from 'express'
import { EntityNotFoundError } from '../libs/errors'
import WalletService from './WalletService'
import PortalApi from '../libs/PortalApi'

interface ExchangeService {
  getBalance: Function
  sendTransaction: Function
  address: string
}

class MobileService {
  private walletService: WalletService
  private portalApi: PortalApi
  constructor(private prisma: PrismaClient, private exchangeService: ExchangeService) {
    this.walletService = new WalletService(this.prisma)
    this.portalApi = new PortalApi(CUSTODIAN_API_KEY)
  }

  /*
   * Authenticates a mobile user.
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      let { username } = req.body
      username = String(username) 

      console.info(`Attempting to login user: ${username}`)

      let user = await this.getUserByUsername(username).catch((error) => {
        if (error instanceof EntityNotFoundError) {
          console.error(`Failed login for user ${username}`)
          res.status(401).send(`Could not find a user with ${username}`)
          return null
        } else {
          throw error
        }
      })

      if (!user) return
      
      if (!user.clientApiKey) {
        const wallet = await this.walletService.createWallet()
        const clientApiKey = await this.portalApi.getClientApiKey(
          wallet.publicKey
        )
        user = await this.prisma.user.update({
          data: {
            walletId: wallet.id,
            clientApiKey,
            address: wallet.publicKey,
          },
          where: { id: user.id },
        })
        console.info(
          `Created a new wallet and requested an API key for ${username}`
        )
      }
      // if (!Expo.isExpoPushToken(pushToken)) {
      //   console.error(`Push token ${pushToken} is not a valid Expo push token`)
      //   res
      //     .status(400)
      //     .send(`Push token ${pushToken} is not a valid Expo push token`)
      //   return
      // }

      // await this.updateUserPushToken(user.exchangeUserId, pushToken)

      res.status(200).send({
        exchangeUserId: user.exchangeUserId,
        address: user.address, // maybe we dont need to send the address back
        clientApiKey: user.clientApiKey,
      })
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
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
      let { username } = req.body 
      username = String(username) 
      console.info(`Querying for user: ${username}`)
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
        res.status(400).send(`User already exists ${username}`)
        return
      }

      const exchangeUserId = Math.floor(Math.random() * 1000000)
      const existingExchangeUser = await this.getUserByExchangeId(
        exchangeUserId
      ).catch((error) => {
        if (error instanceof EntityNotFoundError) {
          return null
        }
        throw error
      })

      if (existingExchangeUser) {
        res.status(400).send('user already exists with user id, try again')
        return
      }

      console.info(`Calling wallet service to create wallet`)
      const wallet = await this.walletService.createWallet()
      const clientApiKey = await this.portalApi.getClientApiKey(
        wallet.publicKey
      )
      const user = await this.prisma.user.create({
        data: {
          exchangeUserId,
          walletId: wallet.id,
          username,
          clientApiKey,
          address: wallet.publicKey,
        },
      })

      // let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })

      // if (!Expo.isExpoPushToken(pushToken)) {
      //   console.error(`Push token ${pushToken} is not a valid Expo push token`)
      //   res
      //     .status(400)
      //     .send(`Push token ${pushToken} is not a valid Expo push token`)
      //   return
      // }

      console.info(
        `Successfully created a new portal wallet at ${wallet.publicKey}`
      )

      console.info(
        `Transferring funds to new wallet ${wallet.publicKey} from hot wallet at ${this.exchangeService.address}`
      )
      await this.transferExchangeFunds(wallet.publicKey, INIT_AMOUNT)

      // await expo.sendPushNotificationsAsync([
      //   {
      //     to: pushToken,
      //     sound: 'default',
      //     title: 'Mock Exchange',
      //     body: 'You enabled your Portal Wallet!',
      //     data: {
      //       message: `We have initiated a transfer of ${INIT_AMOUNT} to be deposited into your new portal wallet!`,
      //     },
      //   },
      // ])

      console.info(`Successfully signed up ${exchangeUserId}`)
      res
        .status(200)
        .send({ exchangeUserId: user.exchangeUserId, address: user.address, clientApiKey: user.clientApiKey })
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
    }
  }

  async createUser(username: string) {
    const exchangeUserId = Math.floor(Math.random() * 1000000)
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
    const wallet = await this.walletService.createWallet()
    const clientApiKey = await this.portalApi.getClientApiKey(
      wallet.publicKey
    )
    const user = await this.prisma.user.create({
      data: {
        exchangeUserId,
        walletId: wallet.id,
        username,
        clientApiKey,
        address: wallet.publicKey,
      },
    })

    return user
  }

  /*
   * Updates the pushToken for a user. Throws an error if use doesnt exist
   */
  async addPushToken(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const pushToken = req.body['pushToken']

      const user = await this.updateUserPushToken(exchangeUserId, pushToken)

      console.info(
        `Successfully received push token ${user.pushToken} for ${user.exchangeUserId}`
      )
      res
        .status(200)
        .send(`Successfully received push token for ${user.exchangeUserId}`)
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
    }
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
      res.status(500).send('Unknown server error')
    }
  }

  /*
   * Transfers an amount of eth from the exchange to the users wallet.
   */
  async transferFunds(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const amount = Number(req.body['amount'])

      const user = await this.getUserByExchangeId(exchangeUserId)

      if (!user.address) {
        throw new Error(`User ${exchangeUserId} does not have an address.`)
      }

      console.log(
        `Transferring ${amount} ETH into ${user.address} (user: ${user.exchangeUserId})`
      )
      await this.transferExchangeFunds(user.address, amount)

      console.info(
        `Successfully submitted transfer for ${amount} ETH into ${user.address} (user: ${user.exchangeUserId})`
      )
      res
        .status(200)
        .send(`Successfully transferred funds for ${exchangeUserId}`)
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
    }
  }

  /*
   * Get the balance of an exchange account for an exchangeUserId
   */
  async getExchangeBalance(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])
      const cache = await this.prisma.exchangeBalance.findFirst()
      let balance = cache?.cachedBalance

      if (!balance) {
        const updatedBalance = await this.exchangeService.getBalance()
        await this.prisma.exchangeBalance.create({
          data: {
            cachedBalance: updatedBalance,
          },
        })
        balance = updatedBalance
      }

      console.info(
        `Successfully sent balance of ${balance} for user ${exchangeUserId}`
      )

      res.status(200).json({ balance })
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
    }
  }

  /*
   * Force a refresh of the exchange balance, and return the new value
   */
  async refreshExchangeBalance(req: any, res: any): Promise<void> {
    try {
      const exchangeUserId = Number(req.params['exchangeUserId'])

      const updatedBalance = await this.exchangeService.getBalance()

      const cachedBalance = await this.prisma.exchangeBalance.findFirst()
      if (!cachedBalance) {
        await this.prisma.exchangeBalance.create({
          data: {
            cachedBalance: updatedBalance,
          },
        })
      } else {
        await this.prisma.exchangeBalance.update({
          where: {
            id: cachedBalance.id,
          },
          data: {
            cachedBalance: updatedBalance,
          },
        })
      }

      console.info(
        `Successfully updated exchange balance of ${updatedBalance} for user ${exchangeUserId}`
      )

      res.status(200).json({ balance: updatedBalance })
    } catch (error) {
      console.error(error)
      res.status(500).send('Unknown server error')
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
      res.status(500).send('Unknown server error')
    }
  }

  /*
   * Gets user by username
   */
  private async getUserByUsername(username: string): Promise<User> {
    console.info(`Querying for user by username: ${username}`)

    const user = await this.prisma.user.findFirst({
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
    const user = await this.prisma.user.findFirst({
      where: { exchangeUserId },
    })

    if (!user) {
      throw new EntityNotFoundError('User', String(exchangeUserId))
    }

    return user
  }

  /*
   * updates push token for a specific exchange user.
   */
  private async updateUserPushToken(exchangeUserId: number, pushToken: string) {
    let id = Number(exchangeUserId)
    console.info(`Querying for exchangeUserId: ${id}`)
    const user = await this.prisma.user.findFirst({
      where: { exchangeUserId: id },
    })

    if (!user) {
      throw new Error('Tried to update a user that doesnt exist')
    } else {
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { pushToken },
      })
      console.info(`Updated user`, updatedUser.pushToken)
      return updatedUser
    }
  }

  /*
   * Transfers an amount of funds from the omnibus to a specific "to" address.
   * Primarily used to send funds to the users connected portal wallet.
   */
  private async transferExchangeFunds(to: string, amount: number) {
    if (!isAddress(to)) {
      throw new Error(`Address ${to} is not a valid ethereum address.`)
    }

    const balance = this.exchangeService.getBalance()
    if (amount >= 0 && Number(balance) < amount) {
      throw new Error(
        `You're balance of ${balance} is too low to transfer ${amount} ETH to your portal wallet`
      )
    }

    this.exchangeService
      .sendTransaction(to, amount)
      .then((res: any) => console.info(`Transaction submitted status: ${res}`))
      .catch(console.error)
  }
}

export default MobileService
