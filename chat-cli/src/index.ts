import { SparkWallet } from "@buildonspark/spark-sdk";
import { InferenceGrid, Role } from "inference-grid-sdk";
import readline from "readline";

// Put your Spark mnemonic here.
const MNEMONIC = "{YOUR_MNEMONIC}";

// This is a rate-limited "public" private key for testing. Replace it with your own to avoid downtime!
const PRIVATE_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

async function main(message: string) {
    const client = new InferenceGrid({
        privateKey: PRIVATE_KEY,
    });

    const { wallet } = await SparkWallet.initialize({
        mnemonicOrSeed: MNEMONIC,
        options: {
            network: "MAINNET"
        }
    });

    console.log("-----")
    const { invoice } = await client.chat({
        maxTokens: 1000,
        temperature: 0.5,
        model: {
            modelIds: ['openai/gpt-4o'],
            flags: [],
        },
        messages: [
            {
                role: Role.SYSTEM,
                content: "Respond to everything in the style of a pirate.",
            },
            {
                role: Role.USER,
                content: message,
            }
        ]
    }, (partialMessage: string) => {
        process.stdout.write(partialMessage);
    });
    console.log("\n-----")

    if (invoice) {
        console.log("Paying invoice...");
        let paymentResult = await wallet.payLightningInvoice({
            invoice: invoice,
            maxFeeSats: 1000,
        });
        console.log(paymentResult);
    } else {
        console.log("No invoice returned");
    }

    await wallet.cleanupConnections();
    process.exit(0);
}

readline.createInterface({
    input: process.stdin,
    output: process.stdout
}).question('Enter a message: ', async (message) => {
    await main(message);
});
