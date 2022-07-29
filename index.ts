import { ContractKit, newKit } from "@celo/contractkit";
import {
  publicKeyToAddress,
  normalizeAddressWith0x,
  privateKeyToAddress,
} from "@celo/utils/lib/address";
import { SignatureUtils } from "@celo/utils/lib/signatureUtils";
import { generateMnemonic, generateKeys } from "@celo/cryptographic-utils";
require("dotenv").config(); // to use .env file

// Variables for general use
let kit: ContractKit; // ContractKit instance
let network = "alfajores"; // "mainnet" or "alfajores" (from .env file)
let networkURL: any; // Forno URL

// Variables for Alice (sender)
let alicePublicAddress: string;
let alicePublicKey: string;
if (!process.env.ALICE_PRIVATE_KEY) {
  throw new Error("Environment variable: ALICE_PRIVATE_KEY is missing");
}
let alicePrivateKey: string = process.env.ALICE_PRIVATE_KEY;

// Variables for Bob (recipient)
let bobPublicAddress: string;
let bobPublicKey: string;
let bobPrivateKey: string;

// Variables for Escrow payment
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
  if (typeof kit == "undefined") {
    throw new Error("variable kit undefined");
  }
  kit.addAccount(alicePrivateKey);

  // sets up your account
  alicePublicAddress = normalizeAddressWith0x(
    privateKeyToAddress(alicePrivateKey)
  );
  kit.defaultAccount = alicePublicAddress;

  // checks account is connected as expected
  console.log(`Alice's public address is: ${alicePublicAddress} \n`);
  // prints Alice's account balance on the relevant network (to check if connection is established as expected)
  const balance: any = await kit.celoTokens.balancesOf(alicePublicAddress);
  console.log(
    `Alice's cUSD balance is: ${kit.web3.utils.fromWei(
      balance.cUSD.toFixed()
    )} \n`
  );
  //   console.log(`Alice's Celo balance is: ${balance.CELO.toFixed()} \n`);

  // creates EscrowWrapper instance
  escrowContract = await kit.contracts.getEscrow();
}

// Alice generates inputs necessary to make escrow payment
async function createTemporaryKeys() {
  const mnemonic = await generateMnemonic();
  console.log(
    `The mnemonic used to generate temporary keys for the escrow payment is:  \n"${mnemonic}"\n`
  ); // print for debugging
  const temporaryKeys = await generateKeys(mnemonic);
  const publicKey = temporaryKeys.publicKey;
  paymentId = publicKeyToAddress(publicKey);
  secret = temporaryKeys.privateKey;

  // Prints to help visualise
  console.log(`Escrow paymentId is: ${paymentId}\n`);
  console.log(`Escrow secret is: ${secret}\n`);
}

// Alice escrows the payment
async function makeEscrowPayment(escrowAmount: number) {
  escrowToken = await kit.contracts.getStableToken();

  // Convert amount into wei: https://web3js.readthedocs.io/en/v1.2.11/web3-utils.html?highlight=towei#towei
  const contractDecimalEscrowAmount = kit.web3.utils.toWei(
    escrowAmount.toString()
  );
  //   console.log("contractDecimalEscrowAmount:", contractDecimalEscrowAmount);
  identifier =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  await escrowToken
    .approve(escrowContract.address, contractDecimalEscrowAmount)
    .sendAndWaitForReceipt();

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
  console.log(
    `Escrow transfer was successful! \nSee transaction at: https://alfajores-blockscout.celo-testnet.org/tx/${transferReceipt.transactionHash} \n`
  );

  const id = await escrowContract.getSentPaymentIds(alicePublicAddress);
  //   console.log("id", id);
}

// Alice revokes escrow payment
async function revokeEscrowPayment() {
  // Wait for expirySeconds before revoking
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms)); // from: https://stackoverflow.com/a/47480429
  await delay(5000); // wait 5 seconds

  const escrowRevocation = await escrowContract.revoke(paymentId);
  const revocationReceipt = await escrowRevocation.sendAndWaitForReceipt();
  console.log(
    `Escrow revocation was successful! \nSee transaction at: https://alfajores-blockscout.celo-testnet.org/tx/${revocationReceipt.transactionHash} \n`
  );
}

// Bob creates a Celo account and connects account to contractkit
async function bobCreatesAccount() {
  const bobMnemonic = await generateMnemonic();
  console.log(`Bob's mnemonic:  \n"${bobMnemonic}"\n`); // print for debugging
  const bobKeys = await generateKeys(bobMnemonic);
  bobPublicKey = bobKeys.publicKey;
  bobPublicAddress = publicKeyToAddress(bobPublicKey);
  bobPrivateKey = bobKeys.privateKey;
}

// Bob withdraws escrow payment from Alice
async function withdrawEscrowPayment() {
  // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L228-L231
  const msgHash = kit.connection.web3.utils.soliditySha3({
    type: "address",
    value: alicePublicAddress,
  });

  if (!process.env.SECRET) {
    throw new Error("Environment variable: SECRET is missing");
  }
  // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L233
  const { r, s, v }: any = kit.connection.web3.eth.accounts.sign(
    msgHash!,
    process.env.SECRET
  );

  // INVARIANT: BOB HAS AN ACCOUNT, THE PAYMENTID AND THE SECRET
  if (!process.env.PAYMENTID) {
    throw new Error("Environment variable: PAYMENTID is missing");
  }
  console.log("paymentId:", process.env.PAYMENTID);

  const escrowWithdrawal = await escrowContract.withdraw(
    process.env.PAYMENTID,
    v,
    r,
    s
  );
  const withdrawalReceipt = await escrowWithdrawal.sendAndWaitForReceipt();
  console.log("Escrow withdrawal was successful", withdrawalReceipt);
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
  await makeEscrowPayment(0.2);
  await revokeEscrowPayment();
  //   await withdrawEscrowPayment();
}

main();
