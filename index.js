// Package requirements
const Web3 = require("web3");
const ContractKit = require("@celo/contractkit");
const privateKeyToAddress = require("@celo/utils/lib/address").privateKeyToAddress;
const normalizeAddressWith0x = require("@celo/utils/lib/address").normalizeAddressWith0x;
const generateKeys = require("@celo/utils/lib/account").generateKeys

// Requirement from Josh's file (not sure why)
require("dotenv").config();

// sets up main variables (for later use)
let web3; // Web3 instance
let contractkit; // ContractKit instance
let network; // "mainnet" or "alfajores" (from .env file)
let networkURL; // Forno URL
let account; // your account (public address and private key) for testing purposes
let escrowAmount; // amount of CELO to be sent from Alice to Bob (only CELO in this example, but any ERC20 token works)

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



/* 
Option 2: Private key-based proof of identity
*/
// Alice makes escrow payment to Bob

const generatedKeys = await generateKeys()

// Bob creates a Celo account


// Bob withdraws escrow payment from Alice





// helper function to run/disable certain components when testing
async function main() {
    // asks user for inputs
    network = await ask("What network do you want to query? (alfajores/mainnet)");
    escrowAmount = await ask(
      "How many CELO would you like to send Bob with the escrow payment?"
    );
    await init();

  }
  
  main();
  