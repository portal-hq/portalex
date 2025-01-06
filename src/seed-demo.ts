import { PrismaClient } from '@prisma/client'

import { CUSTODIAN_API_KEY, WEBHOOK_URL, WEBHOOK_SECRET } from './config'
import PortalApi from './libs/PortalApi'
import { logger } from './libs/logger'
import HotWalletService from './services/HotWalletService'
import MobileService from './services/MobileService'

async function seedDemo() {
  if (!CUSTODIAN_API_KEY || CUSTODIAN_API_KEY === 'test-api-key') {
    logger.info('CUSTODIAN_API_KEY env var missing.')
    process.exit()
  }

  if (!WEBHOOK_URL) {
    logger.info('WEBHOOK_URL env var missing.')
    process.exit()
  }

  const prisma = new PrismaClient()

  const hotWalletService = new HotWalletService('', '')
  const mobileService = new MobileService(prisma, hotWalletService)
  const portalApi = new PortalApi(CUSTODIAN_API_KEY)

  // demo user & demo custodian id
  await mobileService.createUser('demo', false)
  await portalApi.registerWebhook(WEBHOOK_URL, WEBHOOK_SECRET) // demo custodian id
}

void seedDemo()
