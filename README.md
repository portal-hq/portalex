
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

Create and enter a ".env" file:
```

touch .env && nanon .env

```

This should open up the ".env" file.
Go to the ".example.env" file, copy and paste its contents into the ".env" file, and replace all of the <API_KEY>s with your own tokens.

After having this all set up, you should be able to run the command "docker-compose up", and it should print out:
```

EXCHANGE WALLET PUBLIC ADDRESS: 0xC1C27ba3FBFEBc8C220e0d8486A861e9B7CD96eD
Add test eth to this wallet to fund the PortalEx omnibus wallet.

```
You have now set up the Portal Exchange!

