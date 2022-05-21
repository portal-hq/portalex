import axios from 'axios'
import {
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
  async registerWebhook(webhookUri: string, webhookSecret: string) {
    await axios
      .post(
        `${PORTAL_API_URL}/api/webhook`,
        { webhook: webhookUri, secret: webhookSecret },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`, 
          },
        }
      )
      .catch(e => console.error(e.response.data))
  }
}

export default PortalApi
