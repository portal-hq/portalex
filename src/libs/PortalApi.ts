import axios, { AxiosError, AxiosResponse, isAxiosError } from 'axios'

import { PORTAL_API_URL } from '../config'
import { logger } from '../libs/logger'

type PortalClientResponse = {
  id: string
  clientApiKey: string
}

class PortalApi {
  constructor(private apiKey: string) {}

  async getWebOTP(clientId: string): Promise<string> {
    try {
      const { data } = await axios.get(
        `${PORTAL_API_URL}/api/v1/custodians/clients/${clientId}/web-otp`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      )

      return data.otp
    } catch (err) {
      if (isAxiosError(err)) {
        err as AxiosError
        logger.error(`Error getting Web OTP: `, err)
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${err.response?.data['error']}`,
        }
      } else {
        throw {
          status: 500,
          message: `Portal API Error: ${err}`,
        }
      }
    }
  }

  /**
   * Registers a user with portal's connect api
   *
   * @returns clientApiKey
   */
  async getClientApiKey(
    username: string,
    isAccountAbstracted: boolean,
  ): Promise<PortalClientResponse> {
    logger.info(
      `Requesting Client API Key from Connect API for user: ${username}, ${PORTAL_API_URL}, ${this.apiKey}`,
    )
    return await axios
      .post(
        `${PORTAL_API_URL}/api/clients`,
        {
          ...(isAccountAbstracted ? { isAccountAbstracted } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      )
      .then((res) => {
        return res.data
      })
      .catch((err: AxiosError) => {
        const errorData = err.response?.data as {
          error?: string
        }
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${errorData?.error}`,
        }
      })
  }

  async enableEject(
    clientId: string,
    walletId: string,
  ): Promise<{ ejectableUntil: string }> {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    }

    let response: AxiosResponse<{ ejectableUntil: string }>
    try {
      response = await axios.patch<{ ejectableUntil: string }>(
        `${PORTAL_API_URL}/api/v3/custodians/me/clients/${clientId}/enable-eject`,
        { walletId },
        {
          headers: headers,
        },
      )
    } catch (error: any) {
      const errorData = error.response?.data as {
        error?: string
      }
      throw {
        status: error.response?.status,
        message: `Portal API Error: ${errorData.error}`,
      }
    }

    logger.info(`Enable eject response`, {
      responseData: response.data,
    })

    return response.data
  }

  async deprecated_enableEject(
    clientId: string,
    walletId: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    }

    const response = await axios
      .post<string>(
        `${PORTAL_API_URL}/api/v3/custodians/me/clients/${clientId}/prepare-eject`,
        { walletId },
        {
          headers: headers,
        },
      )
      .catch((err: AxiosError) => {
        const errorData = err.response?.data as {
          error?: string
        }
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${errorData.error}`,
        }
      })

    logger.info(`Deprecated Enable Eject Response: ${response.data}`)

    return response.data
  }

  /**
   * Registers this custodian's webhook URL and secret with portal's connect api
   *
   */
  async registerWebhook(webhookUri: string, webhookSecret: string) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    }

    return axios
      .post(
        `${PORTAL_API_URL}/api/webhook`,
        { webhook: webhookUri, secret: webhookSecret },
        {
          headers: headers,
        },
      )
      .catch((err: AxiosError) => {
        const errorData = err.response?.data as {
          error?: string
        }
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${errorData.error}`,
        }
      })
  }
}

export default PortalApi
