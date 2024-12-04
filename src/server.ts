import { PrismaClient } from '@prisma/client'
import { isAxiosError } from 'axios'
import bodyParser from 'body-parser'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { Wallet as EthersWallet } from 'ethers'
import express, { Application, Request, Response } from 'express'
import 'express-async-errors'
import morgan from 'morgan'

import {
  EXCHANGE_WALLET_ADDRESS,
  EXCHANGE_WALLET_PRIVATE_KEY,
  PORTAL_WEB_URL,
  SENDGRID_API_KEY,
  MAGIC_LINK_REDIRECT_URL,
  MAGIC_LINK_FROM_EMAIL,
  MAGIC_LINK_FROM_NAME,
} from './config'
import { alertWebhookMiddleware, authMiddleware } from './libs/auth'
import { logger } from './libs/logger'
import SendGridService from './libs/sendgrid'
import HotWalletService from './services/HotWalletService'
import MobileService from './services/MobileService'
import WebService from './services/WebService'

const app: Application = express()
const port: number = Number(process.env.PORT) || 3000
const prisma = new PrismaClient()

const exchangeWallet = EthersWallet.createRandom()
const exchangePrivateKey =
  EXCHANGE_WALLET_PRIVATE_KEY || exchangeWallet.privateKey
const exchangePublicKey = EXCHANGE_WALLET_ADDRESS || exchangeWallet.address

logger.info(
  `\n\nEXCHANGE WALLET PUBLIC ADDRESS: ${exchangePublicKey}\nAdd test eth to this wallet to fund the PortalEx omnibus wallet.\n\n`,
)

const exchangeService = new HotWalletService(
  prisma,
  exchangePublicKey,
  exchangePrivateKey,
)
const mobileService: MobileService = new MobileService(prisma, exchangeService)
const webService = new WebService(prisma)

app.use(bodyParser.json())
app.use(morgan('tiny'))
app.use(cors())

app.get('/ping', (req: Request, res: Response) => {
  res.status(200).send('pong')
})

/*
 * Auth endpoints
 */
app.post('/mobile/signup', async (req: Request, res: Response) => {
  await mobileService.signUp(req, res)
})

app.post('/mobile/login', async (req: Request, res: Response) => {
  await mobileService.login(req, res)
})

app.post('/magic/new', async (req, res) => {
  const { email } = req.body as { email: string }
  const code = randomUUID()

  await prisma.magicCode.create({
    data: {
      code,
      email,
    },
  })

  const magicLink = `${MAGIC_LINK_REDIRECT_URL}/magic/verify?code=${code}`

  try {
    logger.info(`Sending magic link to ${email}`)

    const sendgrid = new SendGridService(SENDGRID_API_KEY)
    await sendgrid.sendEmail({
      to: email,
      toName: email,
      from: MAGIC_LINK_FROM_EMAIL,
      fromName: MAGIC_LINK_FROM_NAME,
      subject: 'Portal Demo Magic Link',
      body: `Click here to login: ${magicLink}`,
    })

    res.sendStatus(200)
  } catch (err) {
    if (isAxiosError(err)) {
      logger.error(
        `Received ${err.response?.status} from SendGrid: ${JSON.stringify(
          err.response?.data,
        )}`,
      )
    } else {
      logger.error(err)
    }

    res.sendStatus(500)
  }
})

/**
 *  MagicLink verification
 */
app.get(
  '/magic/verify',
  cors({
    credentials: true,
    origin: MAGIC_LINK_REDIRECT_URL,
  }),
  async (req, res) => {
    const { code } = req.query

    const magicCode = await prisma.magicCode.findFirst({
      where: {
        code: code as string,
      },
    })

    if (magicCode) {
      logger.info(`Successfully verified magic link for ${magicCode.email}`)

      // remove the code now that it's been used
      await prisma.magicCode.delete({
        where: {
          id: magicCode.id,
        },
      })

      // create a new user if they don't exist
      const { email } = magicCode

      let user = await prisma.user.findFirst({
        where: {
          username: email,
        },
      })

      if (!user) {
        user = await mobileService.createUser(email, false)
        logger.info(`Created new user ${email}`)
      }

      // set the logged in user
      res.cookie('userEmail', email, { maxAge: 900000, httpOnly: false })

      // res.redirect(`${MAGIC_LINK_REDIRECT_URL}/magic/auth`)
      res.status(200).json({
        exchangeUserId: user.exchangeUserId,
        clientApiKey: user.clientApiKey,
      })
    } else {
      res.sendStatus(401)
    }
  },
)

/*
 * Wallet endpoints
 */
app.get(
  '/mobile/:exchangeUserId/balance',
  async (req: Request, res: Response) => {
    await mobileService.getExchangeBalance(req, res)
  },
)

app.post(
  '/mobile/:exchangeUserId/balance/refresh',
  async (req: Request, res: Response) => {
    await mobileService.refreshExchangeBalance(req, res)
  },
)

app.post(
  '/mobile/:exchangeUserId/transfer',
  async (req: Request, res: Response) => {
    await mobileService.transferFunds(req, res)
  },
)

app.get(
  '/mobile/:exchangeUserId/org-share/fetch',
  async (req: Request, res: Response) => {
    await mobileService.getCustodianBackupShare(req, res)
  },
)

app.get(
  '/mobile/:exchangeUserId/cipher-text/fetch',
  async (req: Request, res: Response) => {
    await mobileService.getClientBackupShare(req, res)
  },
)

app.post(
  '/mobile/:exchangeUserId/cipher-text',
  async (req: Request, res: Response) => {
    await mobileService.storeClientBackupShare(req, res)
  },
)

app.post(
  '/mobile/:exchangeUserId/prepare-eject',
  async (req: Request, res: Response) => {
    await mobileService.prepareEject(req, res)
  },
)

app.get(
  '/portal/:exchangeUserId/authenticate',
  cors({
    credentials: true,
    origin: PORTAL_WEB_URL,
  }),
  async (req: Request, res: Response) => {
    const webOtp = await webService.getWebOtp(
      parseInt(req.params.exchangeUserId),
    )

    res.redirect(`${PORTAL_WEB_URL}/clients/token/validate?otp=${webOtp}`)
  },
)

app.get('/portal/:exchangeUserId/otp', async (req: Request, res: Response) => {
  const webOtp = await webService.getWebOtp(parseInt(req.params.exchangeUserId))

  res.json({
    otp: webOtp,
  })
})

app.post(
  '/webhook/backup/fetch',
  authMiddleware,
  async (req: Request, res: Response) => {
    logger.info('Requested by IP address:', req.ip, req.headers)
    await mobileService.getCustodianBackupShares(req, res)
  },
)

app.post(
  '/webhook/backup',
  authMiddleware,
  async (req: Request, res: Response) => {
    logger.info('Requested by IP address:', req.ip, req.headers)
    await mobileService.storeCustodianBackupShare(req, res)
  },
)

app.post(
  '/alerts/webhook/events',
  alertWebhookMiddleware,
  async (req: Request, res: Response) => {
    await mobileService.storeAlertWebhookEvent(req, res)
  },
)

app.get(
  '/alerts/webhook/events/:alertWebhookEventId',
  authMiddleware,
  async (req: Request, res: Response) => {
    await mobileService.getAlertWebhookEvent(req, res)
  },
)

app.listen(port, () =>
  logger.info(`PortalEx Server listening on port ${port}!`),
)
