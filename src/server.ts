import 'express-async-errors'
import bodyParser from 'body-parser'
import express, { Application } from 'express'
import morgan from 'morgan'
import { PrismaClient } from '@prisma/client'
import { Wallet as EthersWallet } from 'ethers'
import { _TypedDataEncoder } from 'ethers/lib/utils'
import HotWalletService from './services/HotWalletService'
import MobileService from './services/MobileService'
import WalletService from './services/WalletService'
import { EXCHANGE_WALLET_ADDRESS, EXCHANGE_WALLET_PRIVATE_KEY } from './config'
import { authMiddleware } from './libs/auth'

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
const walletService = new WalletService(prisma)

app.use(bodyParser.json())
app.use(morgan('tiny'))

app.get('/ping', async (req: any, res: any) => {
  res.status(200).send('pong')
})
app.post('/mobile/signup', async (req: any, res: any) => {
  await mobileService.signUp(req, res)
})
app.post('/mobile/login', async (req: any, res: any) => {
  await mobileService.login(req, res)
})

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
  '/mobile/:exchangeUserId/cipher-text/fetch',
  async (req: any, res: any) => {
    await mobileService.getCipherText(req, res)
  }
)

app.post('/mobile/:exchangeUserId/cipher-text', async (req: any, res: any) => {
  await mobileService.storeCipherText(req, res)
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
