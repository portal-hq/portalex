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
import { signTypedData_v4 } from "eth-sig-util";

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
      const { type, address } = req.body

      console.log(`signMessage request from address: ${address}`)
      // const signingKey = await walletService.getSigningKey(address)
      // let signature = await signingKey.signDigest(hashMessage(message))
      const personalSign = "Example `personal_sign` message"
      const ethSign = "0x879a053d4800c6354e76c7985a865d2922c82fb5b3f4577b2fe08b998954f2e0"
      let signature = ""
      console.log("Type: ", type);
      
      if (type === "eth_sign"){
        signature = "0xe0238b7c6c84e21d6102222918a9e9d5ee9cad10516c4ab466068893e46935881b9a2932cf689d662da8b9e0a42d1149084076bfa01260f49569c850afb0e8bb1b"
      }else{
        signature = "0xf6de5fb9e6955e7b27bb92a2c4c3ca14dd788649dde1ec947e6a2f3fecf292e55c793731efb2104cc2c1114a1234618b455e517fabdb650e59d6482176bc5aa01c"
      }

      console.log(`Responding with Signature: ${signature}`)
      res.status(200).send(signature)
    } else if (req.body?.method === 'signTransaction') {
      const { transaction, address } = req.body
      
      console.log(`signTransaction request from address: ${address}`)
      // const signingKey = await walletService.getSigningKey(address)
      // const signature = signingKey.signDigest(
      //   keccak256(serialize(<UnsignedTransaction>transaction))
      // )
      const signature = "0xthisisthesignaturefortransaction"
      console.log(`Responding with Signature: ${signature}`)
      res.status(200).send(signature)
    } else if (req.body?.method === 'signTypedData') {
      const { data, address } = req.body

      console.log(`SignTypedData request from address: ${address}`)
      // const privateKey = await walletService.getPrivateKey(address)

      // const jsonData = JSON.parse(data)
      // const signature = signTypedData_v4(Buffer.from(privateKey.slice(2), "hex"), {
      //   data: jsonData,
      // });
      const signature = "0xee6e3b317ac9eec25ff03a441eb9185e4f2fb491cf1790bfe25ef6d091c4dc45718feffa77222e18436adc24e387ba8a27c38d4364b9785d653671a45041fbee1b"
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
