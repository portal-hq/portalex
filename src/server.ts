import 'express-async-errors'
import {
  hashMessage,
  keccak256,
  UnsignedTransaction,
  _TypedDataEncoder,
} from 'ethers/lib/utils'
import { serialize } from '@ethersproject/transactions'
import express, { Application } from 'express'
import bodyPaser from 'body-parser'
import MobileService from './services/MobileService'
import { PrismaClient } from '@prisma/client'
import HotWalletService from './services/HotWalletService'
import WalletService from './services/WalletService'
import { EXCHANGE_WALLET_ADDRESS, EXCHANGE_WALLET_PRIVATE_KEY } from './config'
import { ethers, Wallet as EthersWallet } from 'ethers'
import { signTypedData_v4 } from "eth-sig-util";
import { authMiddleware } from './libs/auth'
import morgan from 'morgan'

const app: Application = express()
const port: number = Number(process.env.PORT) || 3000
const prisma = new PrismaClient()

const exchangeWallet = EthersWallet.createRandom()
const exchangePrivateKey = EXCHANGE_WALLET_PRIVATE_KEY || exchangeWallet.privateKey
const exchangePublicKey = EXCHANGE_WALLET_ADDRESS || exchangeWallet.address

console.info(`\n\nEXCHANGE WALLET PUBLIC ADDRESS: ${exchangePublicKey}\nAdd test eth to this wallet to fund the PortalEx omnibus wallet.\n\n`)

const exchangeService = new HotWalletService(prisma, exchangePublicKey, exchangePrivateKey)
const mobileService: MobileService = new MobileService(prisma, exchangeService)
const walletService = new WalletService(prisma)

app.use(bodyPaser.json())
app.use(morgan('tiny'))

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

app.get('/mobile/:exchangeUserId/cipher-text/fetch', async (req: any, res: any) => {
  await mobileService.getCipherText(req, res)
})

app.post('/mobile/:exchangeUserId/cipher-text', async (req: any, res: any) => {
  await mobileService.storeCipherText(req, res)
})

app.post('/webhook/backup/fetch', authMiddleware, async (req: any, res: any) => {
  await mobileService.getBackupShare(req, res)
})

app.post('/webhook/backup', authMiddleware, async (req: any, res: any) => {
  await mobileService.storeBackupShare(req, res)
})

app.post('/webhook', authMiddleware, async (req, res) => {
  try {    
    if (req.body?.method === 'signMessage') {
      const { message, address } = req.body

      console.log(`signMessage request from address: ${address}`)
      const signingKey = await walletService.getSigningKey(address)
      let signature = await signingKey.signDigest(hashMessage(message))

      console.log(`Responding with Signature: ${signature}`)
      res.status(200).send(signature)
    } else if (req.body?.method === 'signTransaction') {
      const { transaction, address } = req.body
      
      console.log(`signTransaction request from address: ${address}`)
      const signingKey = await walletService.getSigningKey(address)
      const signature = signingKey.signDigest(
        keccak256(serialize(<UnsignedTransaction>transaction))
      )

      console.log(`Responding with Signature: ${signature}`)
      res.status(200).send(signature)
    } else if (req.body?.method === 'signTypedData') {
      const { data, address } = req.body

      console.log(`SignTypedData request from address: ${address}`)
      const privateKey = await walletService.getPrivateKey(address)

      const jsonData = JSON.parse(data)
      const signature = signTypedData_v4(Buffer.from(privateKey.slice(2), "hex"), {
        data: jsonData,
      });
      console.log(`Responding with Signature: ${signature}`)
      res.status(200).send(signature)
    } else if (req.body?.method === 'push') {
      console.log(`Push Notification: ${req.params}`, req.body)
      res.status(200).send()
    } else {
      console.warn('Unknown request type')
      res.status(400).send('Unknown request type')
    }
  } catch (e: any) {
    console.error(e)
    res.status(500).send(e.message)
  }
})

app.listen(port, () =>
  console.log(`PortalEx Server listening on port ${port}!`)
)
