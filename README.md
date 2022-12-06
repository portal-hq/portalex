
# PortalEx

An example that mocks a minimal implementation of a centralized exchange to demonstrate how to integrate Portal.

For documentation on how to use and setup Portal see our docs at [docs.portalhq.io](https://docs.portalhq.io/).

## Dependencies

- docker-compose


## Getting Started

Clone the repo:

```
git clone https://github.com/portal-hq/portalex.git && cd portalex
```

Set up the `.env` file by replacing `YOUR_API_KEY` with your Portal API Key:

```
cp .example.env .env
vim .env
```

Start the containers:

```
docker-compose up
```

You should now have started a postgres dn and with a node server. The server is running at `localhost:3000`.

You can test this by hitting the `/ping` endpoint:

```
curl \
  -X POST \
   -H "Content-Type: application/json" \
  localhost:3000/pong
```

Which should return a `200` with the message `pong`.

There is also a [Postman configuration file](./PortalEx.postman_collection.json) you can import if you prefer to use that over cURL.
## Creating a new user

To test the Portal API create a new user:

```
curl \
  -X POST \
   -H "Content-Type: application/json" \
   -d '{"username": "test"}' \
  localhost:3000/mobile/signup
```

This will return a `clientApiKey` you can use for testing:

```
{
    "exchangeUserId": 619692,
    "clientApiKey": "2basdead-ac6e-4d07-857d-459453b6158b"
}
```

## Registering a Webhook with Ngrok

To register a webhook for your custodian you need a public URL.

To expose your localhost to a random public domain using ngrok run:

```
ngrok http 3000
```

You can use that public ngrok domain to [register as a webhook](https://docs.portalhq.io/reference/rest-api) on Portal.

```
curl \
  -X POST \
   -H "Content-Type: application/json" \
   -d '{"webhook": "<YOUR_NGROK_DOMAIN>", "secret": "secret"}' \
   https://api.portalhq.io/api/v1/custodians/webhook
```

### Using Paid Ngrok Account

If you have a paid ngrok account you can configure the `docker-compose` file to automatically set up the domain. Set the `NGROK_API_KEY` to set it up. Paid accounts also have a permanent domain which is convenient. 
