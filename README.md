# PortalEx

An Express REST API that mocks a minimal implementation of a centralized exchange to demonstrate how to integrate Portal.

## Dependencies

- node
- yarn
- postgres

## Getting Started

First, clone this repository locally and move into it:
```

git clone https://github.com/portal-hq/portalex.git && cd portalex

```

Then check if you have anything running on ports 3000, 5432, and 4040:
```

sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :4040

```

If it states that there is something running on those ports, use the command "kill -9 <Port ID (PID)>" so that no error arises.

Now that you know there won't be any port-related errors, create and enter a ".env" file:
```

touch .env && nanon .env

```

This should open up the ".env" file, where you should copy, paste, and replace all of the following info:
```

# POSTGRES CONFIG

POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=password
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# NGROK CONFIG

NGROK_AUTH=<NGROK_AUTH_KEY>

# PORTALEX CONFIG

PORTALEX_PORT=3000
CUSTODIAN_API_KEY=<YOUR_API_KEY>
DATABASE_URL=postgres://postgres:password@postgres:5432
WEBHOOK_URL=http://localhost:3000

```

After having this all set up, you should be able to run the command "docker-compose up", and it should print out:
```

EXCHANGE WALLET PUBLIC ADDRESS: 0xC1C27ba3FBFEBc8C220e0d8486A861e9B7CD96eD
Add test eth to this wallet to fund the PortalEx omnibus wallet.

```
You have now set up the Portal Exchange

