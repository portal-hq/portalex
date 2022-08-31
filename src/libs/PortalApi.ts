import axios from 'axios'
import {
  PORTAL_API_URL,
} from '../config'

type PortalClientResponse = {
  id: string;
  clientApiKey: string;
};

class PortalApi {
  constructor(private apiKey: string) { }
  
 /**
   * Registers a user with portal's connect api
   *
   * @returns clientApiKey
   */
  async getClientApiKey(username: string): Promise<PortalClientResponse> {
    console.info(
      `Requesting Client API Key from Connect API for user: ${username}`
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
  }


   /**
   * Registers this custodian's webhook URL and secret with portal's connect api
   * 
   */
  async registerWebhook(webhookUri: string, webhookSecret: string) {
   const headers = {
      'Authorization': `Bearer ${this.apiKey}`, 
    }
    
    await axios
      .post(
        `${PORTAL_API_URL}/api/webhook`,
        { webhook: webhookUri, secret: webhookSecret },
        {
          headers: headers,
        }
      )
      .catch(e => console.error(e.response.data))
  }
}

export default PortalApi
