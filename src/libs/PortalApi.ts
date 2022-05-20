import axios from 'axios'
import {
  PORTAL_API_KEY,
  PORTAL_API_SECRET,
  PORTAL_API_URL,
} from '../config'

class PortalApi {
  constructor(private apiKey: string) { }
  
 /**
   * Registers a user with portal's connect api
   *
   * @returns clientApiKey
   */
  async getClientApiKey(address: string): Promise<string> {
    console.info(
      `Requesting Client API Key from Connect API for address: ${address}`
    )
    return await axios
      .post(
        `${PORTAL_API_URL}/api/clients`,
        { address },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      )
      .then((res) => {
        return res.data.clientApiKey
      })
  }


   /**
   * Registers this custodian's webhook URL and secret with portal's connect api
   * 
   */
  async registerWebhook(custodianId: string, webhookUri: string, webhookSecret: string) {
    await axios
      .post(
        `${PORTAL_API_URL}/app/custodians/${custodianId}/webhook`,
        { webhook: webhookUri, secret: webhookSecret, custodianId },
        {
          headers: {
            apikey: PORTAL_API_KEY,
            apisecret: PORTAL_API_SECRET,
            Authorization: `Bearer ${this.apiKey}`, 
          },
        }
      )
  }
}

export default PortalApi
