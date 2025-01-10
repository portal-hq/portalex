import dotenv from 'dotenv'

dotenv.config()

// ==============================
// Environment & Logging
// ==============================
export const loggerEnv = process.env.DD_ENVIRONMENT || 'dev'
export const WinstonConfig = {
  level: process.env.LOG_LEVEL || 'debug',
  silent: process.env.LOGGER_SILENT === 'true' || false,
  datadogKey: process.env.DD_API_KEY || '',
}

// ==============================
// Server Configuration
// ==============================
export const ServerConfig = {
  host: process.env.HOST || '',
  serviceName: 'portalex',
}

// ==============================
// Blockchain Configuration
// ==============================
export const ETH_NETWORK = process.env.ETH_NETWORK || 'sepolia'
export const EXCHANGE_WALLET_ADDRESS = process.env.EXCHANGE_WALLET_ADDRESS || ''
export const EXCHANGE_WALLET_PRIVATE_KEY =
  process.env.EXCHANGE_WALLET_PRIVATE_KEY || ''
export const INIT_AMOUNT = Number(process.env.INIT_AMOUNT) || 0.01

// ==============================
// Portal API Configuration
// ==============================
export const PORTAL_API_URL =
  process.env.PORTAL_API_URL || 'https://api.portalhq.io'
export const PORTAL_WEB_URL =
  process.env.PORTAL_WEB_URL || 'https://web.portalhq.io'
export const CUSTODIAN_API_KEY = process.env.CUSTODIAN_API_KEY || 'test-api-key'

// ==============================
// Webhook Configuration
// ==============================
export const ALERT_WEBHOOK_SECRET = process.env.ALERT_WEBHOOK_SECRET || 'secret'
export const WEBHOOK_URL = process.env.WEBHOOK_URL || '' // need to set the host with /webhook at the end
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret'

// ==============================
// Email & Magic Links Configuration
// ==============================
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || ''
export const MAGIC_LINK_REDIRECT_URL =
  process.env.MAGIC_LINK_REDIRECT_URL || 'http://localhost:3000'
export const MAGIC_LINK_FROM_EMAIL =
  process.env.MAGIC_LINK_FROM_EMAIL || 'david@portalhq.io'
export const MAGIC_LINK_FROM_NAME =
  process.env.MAGIC_LINK_FROM_NAME || 'Portal Demo (David)'

// ==============================
// Alchemy Configuration
// ==============================
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || ''
