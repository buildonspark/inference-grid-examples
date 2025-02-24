import crypto from 'crypto';
import fs from 'fs';

export class Config {
  network: string;
  port: number;
  publicKey: string;
  privateKey: string;
  spark: {mnemonic: string;};

  constructor(data: {
    network: string;
    port: number;
    publicKey: string;
    privateKey: string;
    spark: {mnemonic: string;};
  }) {
    this.network = data.network;
    this.port = data.port;
    this.publicKey = data.publicKey;
    this.privateKey = data.privateKey;
    this.spark = data.spark;
  }

  ws_url(): string {
    if (this.network === 'MAINNET') {
      return 'wss://relay.inferencegrid.ai/consumer/ws';
    } else {
      return 'wss://regtest.inferencegrid.ai/consumer/ws';
    }
  }

  validate() {
    if (!this.network) {
      throw new Error('network is required');
    }

    // Convert public key hex to Buffer
    const publicKeyBuffer = Buffer.from(this.publicKey, 'hex');

    // Convert private key hex to Buffer
    const privateKeyBuffer = Buffer.from(this.privateKey, 'hex');

    // Reconstruct the public key in SPKI format
    const spkiPublicKey = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),  // SPKI header for Ed25519
      publicKeyBuffer
    ]);

    // Reconstruct the private key in PKCS8 format
    const pkcs8PrivateKey = Buffer.concat([
      Buffer.from(
          '302e020100300506032b657004220420',
          'hex'),  // PKCS8 header for Ed25519
      privateKeyBuffer
    ]);

    // Create the key objects
    const publicKeyReconstructed =
        crypto.createPublicKey({key: spkiPublicKey, format: 'der', type: 'spki'});

    const privateKeyReconstructed = crypto.createPrivateKey(
        {key: pkcs8PrivateKey, format: 'der', type: 'pkcs8'});

    // Verify the private key matches the public key.
    const testMessage = Buffer.from('test message');
    const signature = crypto.sign(null, testMessage, privateKeyReconstructed);
    if (!crypto.verify(null, testMessage, publicKeyReconstructed, signature)) {
      throw new Error('Private key does not match public key');
    }
  }

  sign(message: Uint8Array): string {
    const pkcs8PrivateKey = Buffer.concat([
        Buffer.from(
            '302e020100300506032b657004220420',
            'hex'),  // PKCS8 header for Ed25519
        Buffer.from(this.privateKey, 'hex')
      ]);
    const privateKeyReconstructed = crypto.createPrivateKey(
        {key: pkcs8PrivateKey, format: 'der', type: 'pkcs8'});

    const messageBuffer = Buffer.from(message);
    const signature = crypto.sign(null, messageBuffer, privateKeyReconstructed);
    return signature.toString('hex');
  }

  static load(path: string): Config {
    if (!fs.existsSync(path)) {
      throw new Error(`Config file ${path} does not exist.`);
    }
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    return new Config(data);
  }
}