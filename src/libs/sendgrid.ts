import axios from 'axios'

export interface EmailParams {
  to: string
  toName: string
  from: string
  fromName: string
  subject: string
  body: string
}

const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/'

class SendGridService {
  private client: any

  constructor(private key: string) {
    this.client = axios.create({
      baseURL: SENDGRID_URL,
      headers: { Authorization: `Bearer ${key}` },
    })
  }

  async sendEmail(params: EmailParams): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.client.post('send', {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from },
      subject: params.subject,
      content: [
        {
          type: 'text/plain',
          value: params.body,
        },
      ],
    })
  }
}

export default SendGridService
