// Package requirements
const Web3 = require("web3");
const ContractKit = require("@celo/contractkit");
const privateKeyToAddress = require("@celo/utils/lib/address").privateKeyToAddress;
const normalizeAddressWith0x = require("@celo/utils/lib/address").normalizeAddressWith0x;

// Requirement from Josh's file (not sure why)
require("dotenv").config();

// sets up main variables (for later use)
let web3; // Web3 instance
let contractkit; // ContractKit instance
let network; // "mainnet" or "alfajores" (from .env file)
let networkURL; // Forno URL
let account; // your account (public address and private key) for testing purposes

// sets up web3, contractkit, add private key to contractkit
async function init() {

    // sets network URL
    switch (network) {
        case "alfajores":
            networkURL = "https://alfajores-forno.celo-testnet.org";
            break;
        case "mainnet":
            networkURL = "https://forno.celo.org";
            break;
        default:
            console.log("Set NETWORK to either alfajores or mainnet");
    }

    // creates Web3 instance
    web3 = new Web3(networkURL);

    // creates ContractKit instance
    contractkit = ContractKit.newKitFromWeb3(web3);
    contractkit.connection.addAccount(process.env.PRIVATE_KEY);

    // sets up your account
    account = normalizeAddressWith0x(
        privateKeyToAddress(process.env.PRIVATE_KEY)
    );
    contractkit.connection.defaultAccount = account;

    // checks account is connected as expected
    console.log('contractkit account', contractkit.defaultAccount);
    const balance = await contractkit.celoTokens.balancesOf(account); // print your account balance on the relevant network (to check if connection is established as expected)
    console.log('Celo balance', balance.CELO.toFixed());
    console.log('cUSD balance', balance.cUSD.toFixed());
}

