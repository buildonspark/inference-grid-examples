# OpenAI Adapter

The Inference Grid is a decentralized network for AI inference. This folder contains an 
CLI which helps you (1) connect to the Inference Grid using Spark and (2) launch a LLM
endpoint that's compatible with OpenAI's SDKs.

## Install

To install the CLI, run:

```bash
npm install --include=dev
npm run build
npm install -g
```

## Setup

First, you'll need to create a configuration file. This file will contain your Inference Grid
credentials as well as your Spark wallet mnemonic. You can create this file by running:

```bash
oaica init
```

This will save your credentials to `oaica.json`. Don't lose it!

```markdown
{
    "network": "MAINNET",
    "port": 3031,
    "publicKey": "e407b0aec1ebb57dea8e35dc0d4ed954e4d8f3192d82b53c4c42b660af6728a3",
    "privateKey": "5edb56ce65ae267ceda9e8162dbd2dcfd4a20faa7c2d64c2744df61173afeb10",
    "spark": {
        "mnemonic": "typical stereo dose party penalty decline neglect feel harvest abstract stage winter"
    }
}
```

> [!NOTE]  
> If you created a new Spark Wallet, you'll need to add some funds to it. Ask the event
> organizers for some money to get started!

## Usage

Next, you can serve the chat completion API by running:

```bash
oaica serve
```

This listens on port 3031 by default. For example, to use it with the OpenAI Python SDK, you
can do the following:

```python
import json
from openai import OpenAI

model_spec = {
    "tier_selector": ">3",
    "flags": [
        "uncensored", # Support open source, uncensored models.
    ],
}

client = OpenAI(
    base_url="http://localhost:3031",
)

client.chat.completions.create(
    model=json.dumps(model_spec),
    messages=[
        {
            "role": "user",
            "content": "Tell me a joke!",
        },
    ],
)
```

This request will be routed to providers on the Inference Grid and paid for from your Spark 
wallet in real-time. Check out the [example.py](./example.py) file for more examples!

## Wallet

If you're wallet is running low, you can check your balance and add more by running:

```bash
oaica wallet
```

Ask a member of the event staff to give you some money to explore!
