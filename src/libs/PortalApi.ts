import axios, { AxiosError } from 'axios'
import { PORTAL_API_URL } from '../config'

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
        }
      )

      return data.otp
    } catch (err) {
      console.error(`Error getting Web OTP: `, err)
      throw {
        status: (err as AxiosError).response?.status,
        message: `Portal API Error: ${
          (err as AxiosError).response?.data['error']
        }`,
      }
    }
  }

  /**
   * Registers a user with portal's connect api
   *
   * @returns clientApiKey
   */
  async getClientApiKey(username: string): Promise<PortalClientResponse> {
    console.info(
      `Requesting Client API Key from Connect API for user: ${username}, ${PORTAL_API_URL}, ${this.apiKey}`
    )
    return await axios
      .post(
        `${PORTAL_API_URL}/api/clients`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      )
      .then((res) => {
        return res.data
      })
      .catch((err: AxiosError) => {
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${err.response?.data['error']}`,
        }
      })
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
        }
      )
      .catch((err: AxiosError) => {
        throw {
          status: err.response?.status,
          message: `Portal API Error: ${err.response?.data['error']}`,
        }
      })
  }
}

export default PortalApi
