import { PrismaClient } from '@prisma/client'

import { CUSTODIAN_API_KEY } from '../config'
import PortalApi from '../libs/PortalApi'

export default class WebService {
  private portalApi: PortalApi

  constructor(private prisma: PrismaClient) {
    this.portalApi = new PortalApi(CUSTODIAN_API_KEY)
  }

  async getWebAuthToken(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (!user.clientId) {
      throw new Error('User does not have a client ID')
    }

    const authToken = await this.portalApi.getClientAuthToken(user.clientId)

    if (!authToken) {
      throw new Error('Unable to get auth token')
    }

    return authToken
  }
}
