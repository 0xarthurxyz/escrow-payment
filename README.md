# escrow-payment

A repo to show how to make escrow payments on Celo.

## Prerequisites

You will need:

- [ ] `Node v12` - we recommended you use NVM `nvm use 12` for this example
- [ ] `Yarn`
- [ ] `Git`

## Start

- [ ] Install dependencies in top level folder

    ```bash
    yarn install
    ```

- [ ] Set `PRIVATE_KEY` in `.env` variables
  - Create a new account (for testing purposes) by running the command below. This will print a new `public address` and `private key` to the console. You can use these for testing the escrow flows locally.

    ```bash
    yarn createAccount
    ```
  
  - Or you can use an existing account (e.g. Metamask > Account Details > Export Private Key)

- [ ] You will need some gas to interact with the escrow contract.
  - For Celo's Alfajores testnet you can get some gas from the [faucet](https://celo.org/developers/faucet)

