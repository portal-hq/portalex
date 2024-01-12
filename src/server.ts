import 'express-async-errors'
import cors from 'cors'
import bodyParser from 'body-parser'
import express, { Application, Request, Response } from 'express'
import morgan from 'morgan'
import { PrismaClient } from '@prisma/client'
import { Wallet as EthersWallet } from 'ethers'
import { _TypedDataEncoder } from 'ethers/lib/utils'
import HotWalletService from './services/HotWalletService'
import MobileService from './services/MobileService'
import {
  EXCHANGE_WALLET_ADDRESS,
  EXCHANGE_WALLET_PRIVATE_KEY,
  PORTAL_WEB_URL,
  SENDGRID_API_KEY,
  MAGIC_LINK_REDIRECT_URL,
  MAGIC_LINK_FROM_EMAIL,
  MAGIC_LINK_FROM_NAME
} from './config'
import { authMiddleware } from './libs/auth'
import WebService from './services/WebService'
import { randomUUID } from 'crypto'
import SendGridService from './libs/sendgrid'
import { isAxiosError } from 'axios'

const app: Application = express()
const port: number = Number(process.env.PORT) || 3000
const prisma = new PrismaClient()

const exchangeWallet = EthersWallet.createRandom()
const exchangePrivateKey =
  EXCHANGE_WALLET_PRIVATE_KEY || exchangeWallet.privateKey
const exchangePublicKey = EXCHANGE_WALLET_ADDRESS || exchangeWallet.address

console.info(
  `\n\nEXCHANGE WALLET PUBLIC ADDRESS: ${exchangePublicKey}\nAdd test eth to this wallet to fund the PortalEx omnibus wallet.\n\n`
)

const exchangeService = new HotWalletService(
  prisma,
  exchangePublicKey,
  exchangePrivateKey
)
const mobileService: MobileService = new MobileService(prisma, exchangeService)
const webService = new WebService(prisma)

app.use(bodyParser.json())
app.use(morgan('tiny'))
app.use(cors())

app.get('/ping', async (req: any, res: any) => {
  res.status(200).send('pong')
})

/*
 * Auth endpoints
 */
app.post('/mobile/signup', async (req: any, res: any) => {
  await mobileService.signUp(req, res)
})

app.post('/mobile/login', async (req: any, res: any) => {
  await mobileService.login(req, res)
})


app.post('/magic/new', async (req, res) => {
  const { email } = req.body
  const code = randomUUID()

  await prisma.magicCode.create({
    data: {
      code,
      email,
    }
  })

  const magicLink = `${MAGIC_LINK_REDIRECT_URL}/magic/verify?code=${code}`;

  try {
    console.log(`Sending magic link to ${email}`)

    const sendgrid = new SendGridService(SENDGRID_API_KEY)
    await sendgrid.sendEmail({
      to: email,
      toName: email,
      from:  MAGIC_LINK_FROM_EMAIL,
      fromName: MAGIC_LINK_FROM_NAME,
      subject: 'Portal Demo Magic Link',
      body: `Click here to login: ${magicLink}`
    })
    
    res.sendStatus(200)
  } catch (err) {
    if (isAxiosError(err)) {
      console.error(`Received ${err.response?.status} from SendGrid: ${JSON.stringify(err.response?.data)}`)
    } else {
      console.error(err)
    }

    res.sendStatus(500)
  }
})

/**
 *  MagicLink verification
 */
app.get('/magic/verify',   
  cors({
    credentials: true,
    origin: MAGIC_LINK_REDIRECT_URL
  }),  
  async (req, res) => {
    const { code } = req.query

    const magicCode = await prisma.magicCode.findFirst({
      where: {
        code: code as string
      }
    })

    if (magicCode) {
      console.log(`Successfully verified magic link for ${magicCode.email}`)

      // remove the code now that it's been used
      await prisma.magicCode.delete({
        where: {
          id: magicCode.id
        }
      })

      // create a new user if they don't exist
      const { email } = magicCode

      let user = await prisma.user.findFirst({
        where: {
          username: email
        }
      })

      if (!user) {
        user = await mobileService.createUser(email, false)
        console.log(`Created new user ${email}`)
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
})

/*
 * Wallet endpoints
 */
app.get('/mobile/:exchangeUserId/balance', async (req: any, res: any) => {
  await mobileService.getExchangeBalance(req, res)
})

app.post(
  '/mobile/:exchangeUserId/balance/refresh',
  async (req: any, res: any) => {
    await mobileService.refreshExchangeBalance(req, res)
  }
)

app.post('/mobile/:exchangeUserId/transfer', async (req: any, res: any) => {
  await mobileService.transferFunds(req, res)
})

app.get(
  '/mobile/:exchangeUserId/org-share/fetch',
  async (req: any, res: any) => {
    await mobileService.getOrgShare(req, res)
  }
)

app.get(
  '/mobile/:exchangeUserId/cipher-text/fetch',
  async (req: any, res: any) => {
    await mobileService.getCipherText(req, res)
  }
)

app.post('/mobile/:exchangeUserId/cipher-text', async (req: any, res: any) => {
  await mobileService.storeCipherText(req, res)
})

app.get(
  '/portal/:exchangeUserId/authenticate',
  cors({
    credentials: true,
    origin: PORTAL_WEB_URL,
  }),
  async (req: Request, res: Response) => {
    const webOtp = await webService.getWebOtp(
      parseInt(req.params.exchangeUserId)
    )

    res.redirect(`${PORTAL_WEB_URL}/clients/token/validate?otp=${webOtp}`)
  }
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
  async (req: any, res: any) => {
    console.log('Requested by IP address:', req.ip, req.headers)
    await mobileService.getBackupShare(req, res)
  }
)

app.post('/webhook/backup', authMiddleware, async (req: any, res: any) => {
  console.log('Requested by IP address:', req.ip, req.headers)
  await mobileService.storeBackupShare(req, res)
})

app.listen(port, () =>
  console.log(`PortalEx Server listening on port ${port}!`)
)
