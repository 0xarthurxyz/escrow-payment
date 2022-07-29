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
let network = "alfajores"; // "mainnet" or "alfajores" (from .env file)
let networkURL: any; // Forno URL

// Variables for Alice (sender)
let alicePublicAddress: string;
let alicePublicKey: string;
if (!process.env.ALICE_PRIVATE_KEY) {
  throw new Error("Environment variable: ALICE_PRIVATE_KEY is missing");
}
let alicePrivateKey: string = process.env.ALICE_PRIVATE_KEY;
let aliceKit: ContractKit; // Alice's ContractKit instance

// Variables for Bob (recipient)
let bobPublicAddress: string;
let bobPublicKey: string;
let bobPrivateKey: string;
let bobKit: ContractKit; // Bob's ContractKit instance

// Variables for Escrow payment
let escrowContract: any; // Instance of the Escrow.sol contract wrapper
let identifier: string; // obfuscated representation of user's identity (e.g. phone number)
let paymentId: string;
let secret: string;
let escrowToken: any; // token to be sent from Alice to Bon (cUSD in this example, but any ERC20 token works)
let escrowAmount: number; // amount of tokens to be sent from Alice to Bob

// Variables for third party gas station
let gasKit: ContractKit;
if (!process.env.GAS_STATION_PUBLIC_ADDRESS) {
  throw new Error(
    "Environment variable: GAS_STATION_PUBLIC_ADDRESS is missing"
  );
}
let gasPublicAddress: string = process.env.GAS_STATION_PUBLIC_ADDRESS;
if (!process.env.GAS_STATION_PRIVATE_KEY) {
  throw new Error("Environment variable: GAS_STATION_PRIVATE_KEY is missing");
}
let gasPrivateKey: string = process.env.GAS_STATION_PRIVATE_KEY;

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

  // creates ContractKit instance for Alice
  aliceKit = await newKit(networkURL);
  if (typeof aliceKit == "undefined") {
    throw new Error("variable aliceKit undefined");
  }
  aliceKit.addAccount(alicePrivateKey);

  // sets up your account
  alicePublicAddress = normalizeAddressWith0x(
    privateKeyToAddress(alicePrivateKey)
  );
  aliceKit.defaultAccount = alicePublicAddress;

  // checks account is connected as expected
  console.log(`Alice's public address is: ${alicePublicAddress} \n`);
  // prints Alice's account balance on the relevant network (to check if connection is established as expected)
  const balance: any = await aliceKit.celoTokens.balancesOf(alicePublicAddress);
  console.log(
    `Alice's cUSD balance is: ${aliceKit.web3.utils.fromWei(
      balance.cUSD.toFixed()
    )} \n`
  );
  //   console.log(`Alice's Celo balance is: ${balance.CELO.toFixed()} \n`);

  // creates EscrowWrapper instance
  escrowContract = await aliceKit.contracts.getEscrow();
}

// Alice generates inputs necessary to make escrow payment
async function aliceCreatesTemporaryKeys() {
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
async function aliceMakesEscrowPayment(escrowAmount: number) {
  escrowToken = await aliceKit.contracts.getStableToken();

  // Convert amount into wei: https://web3js.readthedocs.io/en/v1.2.11/web3-utils.html?highlight=towei#towei
  const contractDecimalEscrowAmount = aliceKit.web3.utils.toWei(
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
    `Alice's payment into escrow was successful! \nSee transaction at: https://alfajores-blockscout.celo-testnet.org/tx/${transferReceipt.transactionHash} \n`
  );

  //   const id = await escrowContract.getSentPaymentIds(alicePublicAddress);
  //   console.log("id", id);
}

// Alice revokes escrow payment
async function aliceRevokeEscrowPayment() {
  // Wait for expirySeconds before revoking
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms)); // from: https://stackoverflow.com/a/47480429
  await delay(5000); // wait 5 seconds

  const escrowRevocation = await escrowContract.revoke(paymentId);
  const revocationReceipt = await escrowRevocation.sendAndWaitForReceipt();
  console.log(
    `Alice's escrow payment revocation was successful! \n-paymentID = ${paymentId})\nSee transaction at: https://alfajores-blockscout.celo-testnet.org/tx/${revocationReceipt.transactionHash} \n`
  );
}

// Bob creates a Celo account and connects account to contractkit
async function bobCreatesAccount() {
  // creates accounts for Bob
  const bobMnemonic = await generateMnemonic();
  console.log(`Bob's mnemonic:  \n"${bobMnemonic}"\n`); // print for debugging
  const bobKeys = await generateKeys(bobMnemonic);
  bobPublicKey = bobKeys.publicKey;
  bobPublicAddress = publicKeyToAddress(bobPublicKey);
  bobPrivateKey = bobKeys.privateKey;

  // creates ContractKit instance for Bob
  bobKit = await newKit(networkURL);
  if (typeof bobKit == "undefined") {
    throw new Error("variable bobKit undefined");
  }
  bobKit.addAccount(bobPrivateKey);
  bobKit.defaultAccount = bobPublicAddress;
}

async function gasStationFundsBobAccount() {
  // INVARIANT: Bob doesn't have CELO/cSTABLES to pay gas fees, so gas station funds his account

  // connect gas station
  gasKit = await newKit(networkURL);
  if (typeof gasKit == "undefined") {
    throw new Error("variable gasKit undefined");
  }
  gasKit.addAccount(gasPrivateKey);
  gasKit.defaultAccount = gasPublicAddress;

  // Shows gas station is connected and has sufficient funds
  const gasStationBalance: any = await gasKit.celoTokens.balancesOf(
    gasPublicAddress
  );
  console.log(
    `Gas station: 
    \n-Public address = ${gasPublicAddress} 
    \n-Private Key: ${gasPrivateKey}
    \n-Gas station's CELO balance is: ${gasKit.web3.utils.fromWei(
      gasStationBalance.CELO.toFixed()
    )}
    \n-Gas station's cUSD balance is: ${gasKit.web3.utils.fromWei(
      gasStationBalance.cUSD.toFixed()
    )}\n`
  );

  // Gas station makes small transfer to Bob
  // get token contract
  const stableToken = await gasKit.contracts.getStableToken();
  const goldToken = await gasKit.contracts.getGoldToken();
  // approve
  await stableToken
    .approve(bobPublicAddress, gasKit.web3.utils.toWei("0.01"))
    .sendAndWaitForReceipt();
  await goldToken
    .approve(bobPublicAddress, gasKit.web3.utils.toWei("0.01"))
    .sendAndWaitForReceipt();

  // transfer CELO
  const gasFeeTransferInCELO = await goldToken.transfer(
    bobPublicAddress,
    gasKit.web3.utils.toWei("0.01")
  );
  const gasFeeTransferInCELOReceipt =
    await gasFeeTransferInCELO.sendAndWaitForReceipt();
  // transfer cUSD
  const gasFeeTransferInStabletoken = await stableToken.transfer(
    bobPublicAddress,
    gasKit.web3.utils.toWei("0.01")
  );
  const gasFeeTransferInStabletokenReceipt =
    await gasFeeTransferInStabletoken.sendAndWaitForReceipt();

  console.log(
    `Gas station successfully funded Bob's account with CELO and cUSD!\n`
  );

  const bobBalance: any = await bobKit.celoTokens.balancesOf(bobPublicAddress);
  console.log(
    `Bob has an account: 
    \n-Public address = ${bobPublicAddress} 
    \n-Private Key: ${bobPrivateKey}
    \n-Bob's CELO balance is: ${bobKit.web3.utils.fromWei(
      bobBalance.CELO.toFixed()
    )}
    \n-Bob's cUSD balance is: ${bobKit.web3.utils.fromWei(
      bobBalance.cUSD.toFixed()
    )}\n`
  );
}

// Bob withdraws escrow payment from Alice
async function bobWithdrawsEscrowPayment() {
  // Temporary: Create new kit instance to sign with `secret`
  // TODO Arthur: find out how to add multiple accounts to kit instance
  // kit.addAccount(secret)
  const secretKit = await newKit(networkURL);
  if (typeof secretKit == "undefined") {
    throw new Error("variable secretKit undefined");
  }
  secretKit.addAccount(secret);
  secretKit.defaultAccount = paymentId;

  // Get { v, r, s } arguments for withdraw()
  // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L228-L231
  const msgHash = secretKit.connection.web3.utils.soliditySha3({
    type: "address",
    value: bobPublicAddress,
  });
  // From Valora: https://github.com/valora-inc/wallet/blob/178a0ac8e0bce10e308a7e4f0a8367a254f5f84d/src/escrow/saga.ts#L233
  const { r, s, v }: any = secretKit.connection.web3.eth.accounts.sign(
    msgHash!,
    secret
  );

  // INVARIANT: BOB HAS AN ACCOUNT WITH NON-ZERO BALANCE AND KNOWS THE PAYMENTID+SECRET
  console.log(`Bob knows: \n-paymentID = ${paymentId} \n-secret = ${secret}\n`);

  const bobEscrowWrapper = await bobKit.contracts.getEscrow();
  const escrowWithdrawal = await bobEscrowWrapper.withdraw(paymentId, v, r, s);
  const withdrawalReceipt = await escrowWithdrawal.sendAndWaitForReceipt();
  console.log(
    `Bob's withdrawal from escrow was successful! \nSee transaction at: https://alfajores-blockscout.celo-testnet.org/tx/${withdrawalReceipt.transactionHash} \n`
  );

  // Checks Bob's new balance
  const balance: any = await bobKit.celoTokens.balancesOf(bobPublicAddress);
  console.log(
    `Bob's new cUSD balance is: ${bobKit.web3.utils.fromWei(
      balance.cUSD.toFixed()
    )}\n`
  );
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
  await aliceCreatesTemporaryKeys();
  await aliceMakesEscrowPayment(0.1);
    // await aliceRevokeEscrowPayment();
  //   await aliceMakesEscrowPayment(0.2);
  await bobCreatesAccount();
  await gasStationFundsBobAccount();
  await bobWithdrawsEscrowPayment();
}

main();
