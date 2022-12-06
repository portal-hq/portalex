
# PortalEx

An Express REST API that mocks a minimal implementation of a centralized exchange to demonstrate how to integrate Portal.

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

You can test this by creating a new user:

```
curl \
  -X POST \
   -H "Content-Type: application/json" \
   -d '{"username": "test"}' \
  localhost:3000/mobile/signup
```

## Using Ngrok 

To expose your localhost to a random public domain run:

```
ngrok http 3000
```

You can use that public ngrok domain to register as webhook on Portal.

### Using Paid Ngrok Account

If you have a paid ngrok account you can configure the `docker-compose` file to automatically set up the domain. Set the `NGROK_API_KEY` to set it up. Paid accounts also have a permanent domain which is convenient. 
