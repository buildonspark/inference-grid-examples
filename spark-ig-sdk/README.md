# spark-ig-sdk

A TypeScript SDK for the Inference Grid.

## Usage

### Generate a config file

If this is the first time you're running the SDK, you can use it to generate a config file
which will be used to initialize the client. You should only do this once per application
since it is used to uniquely identify your application to the Inference Grid.

```ts
import { InferenceGridClient, Network } from 'spark-ig-sdk';

InferenceGridClient.generateConfig(Network.REGTEST).then((config) => {
    console.log(config);
});
```

::: tip
Typically, registering new clients requires a 50-sat registration fee. However, we've 
temporarily waived this fee for the Spark Hackathon event.
:::

### Initialize the client

Once you have a config file, you can initialize the client.

```ts
import { InferenceGridClient, Network } from 'spark-ig-sdk';

const client = new InferenceGridClient({
    "network": Network.REGTEST,
    "publicKey": "180a65900c6184a1f5466573912516d0d267c0fcb0a27aa3187f122ded3049e1",
    "privateKey": "39a1f3bdec8ec6a57f4a48eda7b3f348a301ff39ea32d4bacca0094ece573698",
})
```

### Chat

To use the chat API, you need to provide a list of messages, a set of options, and two
callbacks: one for receiving partial results and one for receiving the final invoice.

```ts
let message = "";

// This function is called whenever the client receives a partial response and it 
// concatenates the partial response to the message.
function onUpdate(partial: string) {
    // Append the message to the response!
    message += partial;
}

// This function is called when the client has received a complete response and it
// displays the message. If the invoice is not null, it means the user needs to pay
// for the response.
function onComplete(invoice?: string) {
    if (invoice) {
        // TODO: Pay the invoice using Spark!
    }
    alert(message);
}

client.chat(
    [
        {
            role: Role.SYSTEM,
            content: "You are a helpful assistant... but you only speak in ALL CAPS."
        },
        {
            role: Role.USER,
            content: "Say hello!"
        }
    ],
    {
        maxTokens: 1000,
        temperature: 0.9,
        tierSelector: '>3',
        flags: [],
    }, 
    onUpdate, 
    onComplete
);
```
