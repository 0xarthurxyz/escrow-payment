import { 
    ContractKit, 
    newKit 
} from "@celo/contractkit";
import {
  publicKeyToAddress,
  normalizeAddressWith0x,
  privateKeyToAddress,
} from "@celo/utils/lib/address";
import { generateMnemonic, generateKeys } from "@celo/cryptographic-utils";
require("dotenv").config(); // to use .env file

// sets up main variables (for later use)
let kit : ContractKit; // ContractKit instance
let network = "alfajores"; // "mainnet" or "alfajores" (from .env file)
let networkURL: any; // Forno URL
let account: any; // your account (public address and private key) for testing purposes
let identifier: string; // obfuscated representation of user's identity (e.g. phone number)
let paymentId: string;
let secret: string;
let escrowToken: any; // token to be sent from Alice to Bon (only CELO in this example, but any ERC20 token works)
let escrowAmount: number; // amount of tokens to be sent from Alice to Bob

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
  kit = await newKit(networkURL);
  if (typeof(kit) == 'undefined') {
    throw new Error('variable kit undefined');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Environment variable: PRIVATE_KEY is missing");
  }
  kit.addAccount(process.env.PRIVATE_KEY);

  // sets up your account
  account = normalizeAddressWith0x(
    privateKeyToAddress(process.env.PRIVATE_KEY)
  );

  // checks account is connected as expected
  console.log("contractkit account:", kit.defaultAccount);
  console.log("public address:", account);

  // checks connection by querying CELO and cUSD balances
   
  const balance : any = await kit.celoTokens.balancesOf(account); // print your account balance on the relevant network (to check if connection is established as expected)
  console.log('Celo balance:', balance.CELO.toFixed());
  console.log('cUSD balance:', balance.cUSD.toFixed());
   
}

/* 
Option 2: Private key-based proof of identity
*/

// Alice generates inputs necessary to make escrow payment
async function createTemporaryKeys() {
  const mnemonic = await generateMnemonic();
  console.log("mnemonic: ", mnemonic); // print for debugging

  const temporaryKeys = await generateKeys(mnemonic);
  console.log("generatedKeys", temporaryKeys); // print for debugging
  const publicKey = temporaryKeys.publicKey;
  const paymentId = publicKeyToAddress(publicKey);
  const secret = temporaryKeys.privateKey;
}

// Alice escrows the payment
async function makeEscrowPayment(escrowAmount: number) {
  const escrow = await kit.contracts.getEscrow();
//   console.log('escrow instance:', escrow);
  const escrowToken = await kit.contracts.getGoldToken(); 
//   console.log('escrowToken:', escrowToken);

identifier = '0x0000000000000000000000000000000000000000000000000000000000000000'
const contractDecimalEscrowAmount = kit.web3.utils.toWei(escrowAmount.toString());
console.log('contractDecimalEscrowAmount', contractDecimalEscrowAmount);
// const contractDecimalEscrowAmount = (await convertToContractDecimals(escrowAmount, escrowToken)).toString()

// INVARIANT: YOUR ACCOUNT NEEDS CELO


//   const identifier = kit.connection.web3.utils.soliditySha3({
//     type: 'string',
//     value: phoneNumber,
//   })
//   console.log(identifier) // doesn't work yet
  

  await escrow.transfer(
    identifier,
    escrowToken.address, // Celo-only in this example
    escrowAmount,
    0, // expirySeconds
    paymentId,
    0 // minimum attestations
  );
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
  await createTemporaryKeys();
  await makeEscrowPayment(0.2);
}

main();
