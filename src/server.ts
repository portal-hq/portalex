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
import { Wallet as EthersWallet } from 'ethers'

const app: Application = express()
const port: number = Number(process.env.PORT) || 3000
const prisma = new PrismaClient()

const exchangeWallet = EthersWallet.createRandom()
const exchangePrivateKey = EXCHANGE_WALLET_PRIVATE_KEY || exchangeWallet.privateKey
const exchangePublicKey = EXCHANGE_WALLET_ADDRESS || exchangeWallet.address
console.log(`EXCHANGE PUBLIC ADDRESS: ${exchangePublicKey}`)
const exchangeService = new HotWalletService(prisma, exchangePublicKey, exchangePrivateKey)
const mobileService: MobileService = new MobileService(prisma, exchangeService)
const walletService = new WalletService(prisma)

app.use(bodyPaser.json())

app.post('/mobile/signup', async (req: any, res: any) => {
  await mobileService.signUp(req, res)
})
app.post('/mobile/login', async (req: any, res: any) => {
  await mobileService.login(req, res)
})

app.get('/mobile/:exchangeUserId/balance', async (req: any, res: any) => {
  await mobileService.getExchangeBalance(req, res)
})

app.get(
  '/mobile/:exchangeUserId/balance/refresh',
  async (req: any, res: any) => {
    await mobileService.refreshExchangeBalance(req, res)
  }
)

app.get('/mobile/:exchangeUserId/address', async (req: any, res: any) => {
  await mobileService.sendAddress(req, res)
})

app.post('/mobile/:exchangeUserId/token', async (req: any, res: any) => {
  await mobileService.addPushToken(req, res)
})

app.post('/mobile/:exchangeUserId/transfer', async (req: any, res: any) => {
  await mobileService.transferFunds(req, res)
})

app.get('/mobile/:exchangeUserId/walletId', async (req: any, res: any) => {
  await mobileService.sendWalletId(req, res)
})

app.post('/webhook', async (req, res) => {
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
      const { domain, types, value, address } = req.body

      console.log(`SignTypedData request from address: ${address}`)
      const signingKey = await walletService.getSigningKey(address)
      const signature = signingKey.signDigest(
        _TypedDataEncoder.hash(domain, types, value)
      )

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
  console.log(`mock-exchange-server listening on port ${port}!`)
)
