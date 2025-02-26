import * as ed25519 from '@noble/ed25519';
import { FeatureFlag, MessageEnvelope } from './proto/core';
import { sha512 } from "@noble/hashes/sha512";

ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

export enum Network {
    REGTEST = 'regtest',
    MAINNET = 'mainnet',
}

export enum Role {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
}

interface Message {
    role: Role;
    content: string;
}

export interface ClientConfig {
    network: Network;
    publicKey: string;
    privateKey: string;
}

interface ChatOptions {
    maxTokens: number;
    temperature: number;
    tierSelector: string;
    flags: FeatureFlag[];
}

export class InferenceGridClient {
    private config: ClientConfig;

    constructor(config: ClientConfig) {
        this.config = config;
        this.createAuthenticatedSocket().then((socket) => {
            console.log('Connected to the Inference Grid!');
            socket.close();
        }).catch((err) => {
            console.error('Failed to connect to the Inference Grid:', err);
        });
    }

    public static async generateConfig(network: Network = Network.REGTEST): Promise<ClientConfig> {
        const privateKeyBytes = ed25519.utils.randomPrivateKey();
        const privateKey = Buffer.from(privateKeyBytes).toString('hex');
        const publicKeyBytes = await ed25519.getPublicKey(privateKeyBytes);
        const publicKey = Buffer.from(publicKeyBytes).toString('hex');
        return {
            network,
            publicKey,
            privateKey
        };
    }

    private sign(message: Uint8Array): string {
        const signature = ed25519.sign(message, this.config.privateKey);
        return Buffer.from(signature).toString('hex');
    }

    public async chat(
        messages: Message[], 
        options: ChatOptions,
        onUpdate?: (message: string) => void,
        onComplete?: (invoice?: string) => void
    ): Promise<void> {
        // Create a new socket (TODO: reuse the same socket)
        const socket = await this.createAuthenticatedSocket();

        const defaultOptions: ChatOptions = {
            maxTokens: 1000,
            temperature: 0.9,
            tierSelector: '>3',
            flags: []
        };

        const finalOptions = { ...defaultOptions, ...options };
        await this.sendChatRequest(socket, messages, finalOptions, onUpdate || (() => {}), onComplete || (() => {}));
    }

    private async createAuthenticatedSocket(): Promise<WebSocket> {
        const socket = new WebSocket(
            this.config.network === Network.REGTEST ? 'wss://regtest.inferencegrid.ai/consumer/ws' : 'wss://relay.inferencegrid.ai/consumer/ws'
        );
        socket.binaryType = 'arraybuffer';
      
        await new Promise<void>((resolve, reject) => {
            socket.onopen = () => resolve();
            socket.onerror = (event: Event) => {
                console.error(`Error connecting: ${event}`);
                reject(event);
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
                        publicKey: new Uint8Array(Buffer.from(this.config.publicKey, 'hex')),
                        nonce: nonce,
                        signature: new Uint8Array(Buffer.from(this.sign(nonce), 'hex')),
                    },
                    metadata: {
                        name: 'Spark Web Client',
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
                const data = MessageEnvelope.decode(new Uint8Array(event.data as ArrayBuffer));
                resolve(data);
            };
            socket.onerror = (event: Event) => reject(event);
        });
        
        console.log(response);
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

    private async sendChatRequest(
        socket: WebSocket,
        messages: Message[],
        options: Required<ChatOptions>,
        onUpdate: (message: string) => void,
        onComplete: (invoice?: string) => void
    ): Promise<void> {
        const message = MessageEnvelope.create({
            payload: {
                $case: 'chatCompletionRequest',
                chatCompletionRequest: {
                    requestId: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
                    messages: messages.map(m => ({
                        role: m.role,
                        content: {
                            $case: 'text',
                            text: m.content
                        }
                    })),
                    tools: [],
                    tierSelector: options.tierSelector,
                    maxTokens: options.maxTokens,
                    temperature: options.temperature,
                    flags: options.flags
                }
            }
        });

        socket.send(MessageEnvelope.encode(message).finish());

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
                onUpdate(msg.message);
            } else if (data.payload?.$case === 'chatCompletionComplete') {
                complete = true;
                const msg = data.payload.chatCompletionComplete;
                if (msg.invoice) {
                    onComplete(msg.invoice);
                } else {
                    onComplete();
                }
            } else if (data.payload?.$case === 'relayError') {
                const msg = data.payload.relayError;
                console.log(`Adapter received relay error: ${msg.message}`);
                return;
            }
        }
    }
}