/* 
// Standard Celo package requirements
const Web3 = require("web3"); // used to create private keys
const ContractKit = require("@celo/contractkit"); // used to interact with Celo smart contracts

// Requirements to generate variables for escrow payments
const CELO_DERIVATION_PATH_BASE = require("@celo/base/lib/account").CELO_DERIVATION_PATH_BASE; // used to generate private keys
const generateKeys = require("@celo/utils/lib/account").generateKeys
const publicKeyToAddress = require("@celo/utils/lib/address").publicKeyToAddress; // used to generate public address
const normalizeAddressWith0x = require("@celo/utils/lib/address").normalizeAddressWith0x;
*/

import { ContractKit, newKit } from "@celo/contractkit";
// import { 
//     CELO_DERIVATION_PATH_BASE,
//     ensureLeading0x 
// } from "@celo/base";
import {
    publicKeyToAddress,
    normalizeAddressWith0x,
    privateKeyToAddress
} from "@celo/utils/lib/address";
import { 
    generateMnemonic,
    generateKeys
} from "@celo/cryptographic-utils";
// import {  } from ;

// Escrow smart contract requirements

// Requirement from Josh's file (not sure why)
require("dotenv").config();

// sets up main variables (for later use)
let web3: any; // Web3 instance
let contractkit: any; // ContractKit instance
let network = "alfajores"; // "mainnet" or "alfajores" (from .env file)
let networkURL: any; // Forno URL
let account: any; // your account (public address and private key) for testing purposes
let escrowAmount: any; // amount of CELO to be sent from Alice to Bob (only CELO in this example, but any ERC20 token works)

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

    // creates ContractKit instance
    const kit = await newKit(networkURL);
    if ( ! process.env.PRIVATE_KEY ) {
        throw new Error("Environment variable: PRIVATE_KEY is missing");
    }
    kit.addAccount(process.env.PRIVATE_KEY);
   
    // sets up your account
    account = normalizeAddressWith0x(
        privateKeyToAddress(process.env.PRIVATE_KEY)
    );

    // checks account is connected as expected
    console.log('contractkit account:', kit.defaultAccount);
    console.log('public address:', account);
        
    // checks connection by querying CELO and cUSD balances
    /*  
    const balance : any = await kit.celoTokens.balancesOf(account); // print your account balance on the relevant network (to check if connection is established as expected)
    console.log('Celo balance:', balance.CELO.toFixed());
    console.log('cUSD balance:', balance.cUSD.toFixed());
    */
}
// Alice makes escrow payment to Bob

/* 
Option 2: Private key-based proof of identity
*/
async function createPaymentId() {    
    
    const mnemonic = await generateMnemonic();
    console.log('mnemonic: ', mnemonic); // print for debugging
    
    const generatedKeys = await generateKeys(mnemonic);
    console.log('generatedKeys', generatedKeys); // print for debugging
    const publicKey = generatedKeys.publicKey
    const privateKey = generatedKeys.privateKey;
    const paymentId = publicKeyToAddress(publicKey);
}


// Bob creates a Celo account


// Bob withdraws escrow payment from Alice


// helper function to run/disable certain components when testing
async function main() {
    // asks user for inputs
    // network = await ask("What network do you want to query? (alfajores/mainnet)");
    
    /* 
    escrowAmount = await ask(
        "How many CELO would you like to send Bob with the escrow payment?"
        ); 
        */
       
       await init();
       await createPaymentId();
       
    }
  
  main();
  