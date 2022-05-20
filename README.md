# PortalEx

An Express REST API that mocks a minimal implementation of a centralized exchange to demonstrate how to integrate Portal.

## Dependencies

- node
- yarn
- postgres

## Getting Started

```
# start a postgres db
docker run \
  -p 5432:5432 \
  --name portal-exchange-db \
  -e POSTGRES_PASSWORD=password \
  postgres

# install dependencies
yarn

# start the server
CUSTODIAN_API_KEY=<YOUR_CUSTODIAN_API_KEY> \
  WEBHOOK=<YOUR_WEBHOOK_URL> \
  yarn demo
```
