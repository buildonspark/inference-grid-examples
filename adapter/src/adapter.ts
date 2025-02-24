import {WebSocket} from 'ws';
import express from 'express';

import {Config} from './config';
import {ChatCompletionMessage, MessageEnvelope} from './proto/core';
import {FeatureFlag} from './proto/core';

interface ImageURL {
    url: string;
    detail?: string;
}

interface ContentPart {
    type: string;
    text?: string;
    image_url?: ImageURL;
}

interface MultiChatMessage {
    role: string;
    content: ContentPart[];
}

interface ToolCall {
    id: string;
    type: string;
    function?: ToolCallFunction;
}

interface ToolCallFunction {
    name: string;
    arguments: string;
}

interface BasicChatMessage {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
}

interface Tool {
    type: string;
    function: Function;
}

interface Function {
    name: string;
    description: string;
    parameters: any; // json.RawMessage equivalent
}

interface ChatCompletionRequest {
    model: string;
    messages: (MultiChatMessage | BasicChatMessage)[]; // Can be multiChatMessage or basicChatMessage
    tools?: Tool[]; // Can be tool or toolChoice
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

interface ChatCompletionChoice {
    message: BasicChatMessage;
}

interface ChoiceChunk {
    delta: BasicChatMessage;
}

interface ChatCompletionChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChoiceChunk[];
}

interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
}

interface ModelSelector {
    tier_selector: string;
    flags: string[];
}



async function createAuthenticatedSocket(config: Config): Promise<WebSocket> {
  const socket = new WebSocket(config.ws_url());
  socket.binaryType = 'arraybuffer';

  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = (error: Error) => {
      console.error(`Error connecting to ${config.ws_url()}: ${error}`);
      reject(error);
    };
  });

  // Register consumer
  console.log('Attempting to register with relay...');
  const nonce = new TextEncoder().encode('nonce-' + Date.now());
  const info: MessageEnvelope = MessageEnvelope.create({
    payload: {
      $case: 'registerClientRequest',
      registerClientRequest: {
        identity: {
          publicKey: new Uint8Array(Buffer.from(config.publicKey, 'hex')),
          nonce: nonce,
          signature: new Uint8Array(Buffer.from(config.sign(nonce), 'hex')),
        },
        metadata: {
          name: 'Spark OpenAI Adapter',
          url: 'https://spark.info',
          logoUrl: 'https://spark.info/favicon.ico',
          description: '',
        },
      },
    }
  });

  const msgBytes = MessageEnvelope.encode(info);
  socket.send(msgBytes.finish());

  console.log('Waiting for relay response...');
  const response = await new Promise<MessageEnvelope>((resolve, reject) => {
    socket.onmessage = (event: MessageEvent) => {
      const data =
          MessageEnvelope.decode(new Uint8Array(event.data as ArrayBuffer));
      resolve(data);
    };
    socket.onerror = (error: Error) => reject(error);
  });

  if (response.payload!.$case === 'registerClientResponse') {
    const resp = response.payload.registerClientResponse;
    if (!resp.ok) {
      throw new Error(`Connection rejected: ${resp.message}`);
    } else {
      if (resp.invoice) {
        console.log('The registration fee was not paid. Please pay the invoice to continue.');
        console.log(`Invoice: ${resp.invoice}`);
        throw new Error('Connection failed.');
      } else {
        console.log('Connection accepted!');
      }
    }
  } else {
    throw new Error('Unexpected response type');
  }

  return socket;
}

function checkTierSelector(model: string | undefined): boolean {
  if (!model) {
    return true;
  }

  // Check for set notation like {1,2,3}
  if (model.startsWith('{') && model.endsWith('}')) {
    const values = model.slice(1, -1).split(',');
    return values.every(v => !isNaN(parseInt(v.trim())));
  }

  // Check for inequalities like >=2, >2, <=2, <2
  if (model.startsWith('>=') || model.startsWith('<=') ||
      model.startsWith('>') || model.startsWith('<')) {
    const numStr = model.replace(/[<>=]/g, '');
    return !isNaN(parseInt(numStr));
  }

  // Check for single number
  return !isNaN(parseInt(model));
}


async function handleRequest(config: Config, request: express.Request, response: express.Response, payInvoice: (invoice: string) => Promise<void>) {
  // Read and parse request body
  const body = request.body;
  if (!body) {
    response.status(400).send('Missing request body');
    return;
  }

  // Parse model selector
  let modelSelector: ModelSelector = {
    tier_selector: '',
    flags: []
  };
  if (body.model) {
    try {
      modelSelector = JSON.parse(body.model);
    } catch (err) {
      console.log(`Error unmarshalling model selector: ${err}`);
      response.status(400).send('Invalid model selector');
      return;
    }
  }

  if (!checkTierSelector(modelSelector.tier_selector)) {
    response.status(400).send('Invalid tier selector');
    return;
  }
  console.log(`Adapter received model selector: ${JSON.stringify(modelSelector)}`);

  // Convert messages to protobuf format
  const messages = [];
  for (const msg of body.messages) {
    console.log(`Message: ${JSON.stringify(msg)}`);
    
    // Handle multi-part messages
    if (Array.isArray(msg.content)) {
      const contentParts = msg.content.map((part: ContentPart) => {
        if (part.type === 'text') {
          return {
            type: part.type,
            text: part.text
          };
        } else if (part.type === 'image_url') {
          return {
            type: part.type,
            imageUrl: {
              url: part.image_url?.url || '',
              detail: part.image_url?.detail || ''
            }
          };
        }
      });

      messages.push(ChatCompletionMessage.create(   {
        role: msg.role,
        content: {
          $case: 'multi',
          multi: {
            parts: contentParts
          }
        }
      }));
    } else {
      // Handle basic text messages
      messages.push(ChatCompletionMessage.create({
        role: msg.role,
        content: {
          $case: 'text',
          text: msg.content
        }
      }));
    }
  }

  // Convert tools to protobuf format
  const tools = (body.tools || []).map((tool: Tool) => ({
    type: tool.type,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: JSON.stringify(tool.function.parameters)
    }
  }));

  // Build request
  const requestId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const maxTokens = body.max_tokens || 10000;
  const temperature = body.temperature || 0.5;

  const requiredFlags = [];
  if (modelSelector.flags?.includes('vision')) {
    requiredFlags.push(FeatureFlag.IMAGE);
  }
  if (modelSelector.flags?.includes('tool-use')) {
    requiredFlags.push(FeatureFlag.TOOL_CALLS);
  }
  if (modelSelector.flags?.includes('uncensored')) {
    requiredFlags.push(FeatureFlag.UNCENSORED);
  }

  const message = MessageEnvelope.create({
    payload: {
      $case: 'chatCompletionRequest',
      chatCompletionRequest: {
        requestId,
        messages,
        tools,
        tierSelector: modelSelector.tier_selector,
        maxTokens,
        temperature,
        flags: requiredFlags
      }
    }
  });

  const socket = await createAuthenticatedSocket(config);
  const msgBytes = MessageEnvelope.encode(message).finish();
  socket.send(msgBytes);

  if (body.stream) {
    console.log('Streaming response...');

    // Handle streaming response
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    let complete = false;
    while (!complete) {
      const data = await new Promise((resolve, reject) => {
        socket.onmessage = (event) => {
          resolve(MessageEnvelope.decode(new Uint8Array(event.data as ArrayBuffer)));
        };
        socket.onerror = reject;
      }) as MessageEnvelope;

      if (data.payload?.$case === 'chatCompletionPartial') {
        const msg = data.payload.chatCompletionPartial;
        const toolCalls = msg.toolCalls.map((call: ToolCall) => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function?.name || '' ,
            arguments: call.function?.arguments || ''   
          }
        }));

        const chunk: ChatCompletionChunk = {
          id: 'chatcmpl',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'mod',
          choices: [{
            delta: {
              role: 'assistant',
              content: msg.message,
              tool_calls: toolCalls
            }
          }]
        };

        response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } else if (data.payload?.$case === 'chatCompletionComplete') {
        complete = true;
        const msg = data.payload.chatCompletionComplete;
        if (msg.invoice) {
          payInvoice(msg.invoice);
        }
      } else if (data.payload?.$case === 'relayError') {
        const msg = data.payload.relayError;
        console.log(`Adapter received relay error: ${msg.message}`);
        response.status(500).send(msg.message);
        return;
      }
    }

    response.write('data: [DONE]\n\n');
    response.end();
    console.log('Streaming response complete');
  } else {
    // Handle non-streaming response
    console.log('Handling non-streaming response...');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-cache');

    let content = '';
    let activeCallId = '';
    const callIdToFunction = new Map();

    let complete = false;
    while (!complete) {
      const data = await new Promise((resolve, reject) => {
        socket.onmessage = (event) => {
          resolve(MessageEnvelope.decode(new Uint8Array(event.data as ArrayBuffer)));
        };
        socket.onerror = reject;
      }) as MessageEnvelope;

      if (data.payload?.$case === 'chatCompletionPartial') {
        const msg = data.payload.chatCompletionPartial;
        content += msg.message;

        for (const call of msg.toolCalls) {
          if (call.id) {
            activeCallId = call.id;
            callIdToFunction.set(call.id, {
              name: call.function?.name || '',
              arguments: call.function?.arguments || ''
            });
          } else if (activeCallId) {
            const fn = callIdToFunction.get(activeCallId);
            fn.arguments += call.function?.arguments || '';
          }
        }

      } else if (data.payload?.$case === 'chatCompletionComplete') {
        complete = true;
        const msg = data.payload.chatCompletionComplete;
        if (msg.invoice) {
          payInvoice(msg.invoice);
        }
      } else if (data.payload?.$case === 'relayError') {
        const msg = data.payload.relayError;
        console.log(`Adapter received relay error: ${msg.message}`);
        response.status(500).send(msg.message);
        return;
      }
    }

    const toolCalls = Array.from(callIdToFunction.entries()).map(([id, fn]) => ({
      id,
      type: 'function',
      function: fn
    }));

    const responseBody: ChatCompletionResponse = {
      id: '1337',
      object: 'chat.completion',
      created: Date.now(),
      model: body.model,
      choices: [{
        message: {
          role: 'assistant',
          content,
          tool_calls: toolCalls
        }
      }]
    };

    response.json(responseBody);
    response.end();
    console.log('Response complete');
  }
}

export {createAuthenticatedSocket, handleRequest};