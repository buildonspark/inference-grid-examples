import readline from "readline";
import { SparkWallet } from "@buildonspark/spark-sdk";
import { InferenceGrid, Role, Message } from "inference-grid-sdk";

import { WEATHER_TOOL, getWeather } from "./tool.js";

// Put your Spark mnemonic here.
const MNEMONIC = "{YOUR_MNEMONIC}";

// Initialize the Spark Wallet and InferenceGrid client
async function initialize() {
    const client = new InferenceGrid();
    const { wallet } = await SparkWallet.initialize({
        mnemonicOrSeed: MNEMONIC,
        options: {
            network: "MAINNET"
        }
    });
    return { client, wallet };
}

// Pay an invoice using any Lightning wallet. We recommend Spark!
async function payInvoice(invoice: string, wallet: SparkWallet) {
    console.log("Paying invoice...");
    let paymentResult = await wallet.payLightningInvoice({
        invoice: invoice,
        maxFeeSats: 10,
    });
    console.log(paymentResult);
}

async function main(input: string) {
    const { client, wallet } = await initialize();

    // We'll use the system message to set the style of the response, and the user message to pass in the user's input.
    const messages: Message[] = [
        {
            role: Role.SYSTEM,
            content: "Respond to everything in the style of a pirate.",
        },
        {
            role: Role.USER,
            content: input,
        }
    ]

    // We'll start by calling the LLM with the system message and user input.
    const { invoice, message, toolCalls } = await client.chat({
        maxTokens: 1000,
        temperature: 0.5,
        model: {
            modelIds: ['openai/gpt-4o'],
            flags: [],
        },
        messages: messages,
        tools: [WEATHER_TOOL],
    });
    messages.push({
        role: Role.ASSISTANT,
        content: message,
        tool_calls: toolCalls,
    });
    if (invoice) {
        payInvoice(invoice, wallet);
    }

    // If there are no tool calls, we're done!
    if (!toolCalls || toolCalls.length == 0) {
        console.log(message);
        process.exit(0);
    }

    // Now we'll call the tool and add the result to the messages.
    const toolCall = toolCalls[0];
    const toolCallId = toolCall.id;
    const toolArgs = JSON.parse(toolCall.function.arguments);
    const result = await getWeather(toolArgs.city, toolArgs.state);
    messages.push({
        role: Role.TOOL,
        content: JSON.stringify(result),
        tool_call_id: toolCallId,
    });

    // We'll call the LLM again with the new messages.
    const { invoice: invoice2, message: message2 } = await client.chat({
        maxTokens: 1000,
        temperature: 0.5,
        model: {
            modelIds: ['openai/gpt-4o'],
            flags: [],
        },
        messages: messages,
        tools: [WEATHER_TOOL],
    });

    // If there is an invoice, we'll pay it.
    if (invoice2) {
        payInvoice(invoice2, wallet);
    }
    console.log(message2);

    await wallet.cleanupConnections();
    process.exit(0);
}

readline.createInterface({
    input: process.stdin,
    output: process.stdout
}).question('Enter a message: ', async (message) => {
    await main(message);
});
