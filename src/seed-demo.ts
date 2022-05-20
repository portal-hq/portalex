import { PrismaClient } from "@prisma/client"
import PortalApi from "./libs/PortalApi"
import HotWalletService from "./services/HotWalletService"
import MobileService from "./services/MobileService"
import { CUSTODIAN_API_KEY, WEBHOOK, WEBHOOK_SECRET } from "./config"



async function seedDemo() {
  const prisma = new PrismaClient()

  const hotWalletService = new HotWalletService(prisma, "", "")
  const mobileService = new MobileService(prisma, hotWalletService)
  const portalApi = new PortalApi(CUSTODIAN_API_KEY)

  // demo user & demo custodian id
  await mobileService.createUser("demo")
  await portalApi.registerWebhook("cl2kkeezg025850rkxkopozss", WEBHOOK, WEBHOOK_SECRET) // demo custodian id
}

seedDemo()