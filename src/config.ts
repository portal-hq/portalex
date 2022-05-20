import dotenv from 'dotenv'
dotenv.config()

// Exchange Setup
export const EXCHANGE_WALLET_ADDRESS =
  process.env.EXCHANGE_WALLET_ADDRESS || ''
export let EXCHANGE_WALLET_PRIVATE_KEY =
  process.env.EXCHANGE_WALLET_PRIVATE_KEY || ''
export const INIT_AMOUNT = Number(process.env.INIT_AMOUNT) || 0.01

// Portal Setup
export const PORTAL_API_URL =
  process.env.PORTAL_API_URL || 'https://api-staging.portalhq.io'

// Temp User Creds 
export const PORTAL_API_KEY = process.env.PORTAL_API_KEY || '123456abcd'
export const PORTAL_API_SECRET =
  process.env.PORTAL_API_SECRET || 'liontokenaboveall'

// Already set api key 
export const CUSTODIAN_API_KEY =
  process.env.CUSTODIAN_API_KEY || 'test-api-key' // need to set it here from our db

export const ETH_NETWORK = process.env.ETH_NETWORK || 'ropsten'

// Used for demo script to register a webhook
export const WEBHOOK = process.env.WEBHOOK || '' // need to set the host with /webhook at the end
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret'
