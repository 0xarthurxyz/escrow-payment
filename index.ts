import { 
    ContractKit, 
    newKit 
} from "@celo/contractkit";
import {
  publicKeyToAddress,
  normalizeAddressWith0x,
  privateKeyToAddress,
} from "@celo/utils/lib/address";
import { SignatureUtils } from "@celo/utils/lib/signatureUtils"
import { generateMnemonic, generateKeys } from "@celo/cryptographic-utils";
require("dotenv").config(); // to use .env file

// sets up main variables (for later use)
let kit : ContractKit; // ContractKit instance
let network = "alfajores"; // "mainnet" or "alfajores" (from .env file)
let networkURL: any; // Forno URL
let account: any; // your account (public address and private key) for testing purposes
let escrowContract: any; // Instance of the Escrow.sol contract wrapper
let identifier: string; // obfuscated representation of user's identity (e.g. phone number)
let paymentId: string;
let secret: string;
let escrowToken: any; // token to be sent from Alice to Bon (cUSD in this example, but any ERC20 token works)
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
  kit.defaultAccount = account

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
  paymentId = publicKeyToAddress(publicKey);
  secret = temporaryKeys.privateKey;
}

// Alice escrows the payment
async function makeEscrowPayment(escrowAmount: number) {
  escrowContract = await kit.contracts.getEscrow();
  escrowToken = await kit.contracts.getStableToken(); 

  // Convert amount into wei: https://web3js.readthedocs.io/en/v1.2.11/web3-utils.html?highlight=towei#towei
  const contractDecimalEscrowAmount = kit.web3.utils.toWei(escrowAmount.toString());
  console.log('contractDecimalEscrowAmount:', contractDecimalEscrowAmount);
  identifier = '0x0000000000000000000000000000000000000000000000000000000000000000'
  console.log('escrowToken.address:', escrowToken.address);
  console.log('paymentId:', paymentId);

  await escrowToken.approve(escrowContract.address, contractDecimalEscrowAmount).sendAndWaitForReceipt();

  // INVARIANT: ALICE'S ACCOUNT HAS A cUSD BALANCE
  const escrowTransfer = await escrowContract.transfer(
    identifier,
    escrowToken.address,
    contractDecimalEscrowAmount,
    1,
    paymentId,
    0
  );
  const transferReceipt = await escrowTransfer.sendAndWaitForReceipt();
  console.log('Escrow transfer was successful', transferReceipt);

  const id = await escrowContract.getSentPaymentIds(account);
  console.log('id', id)
}

// Alice revokes escrow payment
async function revokeEscrowPayment() {
    // Wait for expirySeconds before revoking
    // from: https://stackoverflow.com/a/47480429
    // const delay = ms => new Promise(res => setTimeout(res, ms));
    // await delay(5000); // 5 seconds


}

// Bob creates a Celo account

// Bob withdraws escrow payment from Alice
async function withdrawEscrowPayment() {

    // ({ v, r, s } = await getVerificationCodeSignature(caller, issuer, phoneHash, accounts))
    // const { v, r, s } = SignatureUtils.signMessage( );

    // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L228-L231
    const msgHash = kit.connection.web3.utils.soliditySha3({
        type: 'address',
        value: account,
    })

    if (!process.env.SECRET) {
        throw new Error("Environment variable: SECRET is missing");
    }
    // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L233
    const { r, s, v }: any = kit.connection.web3.eth.accounts.sign(msgHash!, process.env.SECRET)

    // INVARIANT: BOB HAS AN ACCOUNT, THE PAYMENTID AND THE SECRET
    escrowContract = await kit.contracts.getEscrow();

    if (!process.env.PAYMENTID) {
        throw new Error("Environment variable: PAYMENTID is missing");
    }
    console.log('paymentId:', process.env.PAYMENTID);

    const escrowWithdrawal = await escrowContract.withdraw(process.env.PAYMENTID, v, r, s);
    const withdrawalReceipt = await escrowWithdrawal.sendAndWaitForReceipt();
    console.log('Escrow withdrawal was successful', withdrawalReceipt);
}


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
//   await makeEscrowPayment(0.2);
  await withdrawEscrowPayment();

}

main();
