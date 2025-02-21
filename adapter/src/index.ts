#!/usr/bin/env node

import {Command} from 'commander';
import {SparkWallet} from 'spark-sdk'
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';
import express from 'express';
import clc from 'cli-color';

import {Config} from './config';
import {createAuthenticatedSocket, handleRequest} from './adapter';

const program = new Command();

const green = clc.green;
const red = clc.red;

program.name('oaica')
    .description('An OpenAI-compatible Adapter for the Inference Grid.')
    .version('1.0.0');

program.command('init')
    .description('Initialize a new configuration file.')
    .action(async () => {
      // Generate the key pair
      const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');

      // Export the public key to raw bytes and convert to hex
      const publicKeyHex =
          publicKey.export({type: 'spki', format: 'der'})
              .subarray(12)  // Remove the first 12 bytes (DER metadata)
              .toString('hex');

      // Export the private key to raw bytes and convert to hex
      const privateKeyHex =
          privateKey.export({type: 'pkcs8', format: 'der'})
              .subarray(-32)  // Take the last 32 bytes (raw private key)
              .toString('hex');

      console.log('Generating Inference Grid identity...');
      console.log(green('Public Key (hex):'), publicKeyHex)
      console.log(green('Private Key (hex):'), privateKeyHex);
      console.log('')

      // Ask if they want to use MAINNET or REGTEST
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const network = (await new Promise<string>((resolve) => {
                        rl.question('MAINNET (default) or REGTEST: ', resolve);
                      })).toUpperCase() ||
          'MAINNET';
      console.log(green('Using network:'), network);
      console.log('')

      // Load or create a Spark wallet
      let wallet = new SparkWallet(network === 'MAINNET' ? 0 : 1);
      let mnemonic = await new Promise<string>((resolve) => {
        rl.question(
            'Enter your Spark mnemonic (leave blank for new wallet): ',
            resolve);
      });

      if (mnemonic.length > 0) {
        await wallet.createSparkWallet(mnemonic);
      } else {
        console.log('Creating new wallet...');
        mnemonic = await wallet.generateMnemonic();
        await wallet.createSparkWallet(mnemonic);
        console.log(green('Mnemonic:'), mnemonic);
        console.log('')
      }
      console.log('')

      // TODO: Check balance and prompt them to fund the wallet.

      rl.close();

      console.log('Generating configuration file...');
      let config = new Config({
        network: network,
        port: 3031,
        publicKey: publicKeyHex,
        privateKey: privateKeyHex,
        spark: {
          mnemonic: mnemonic,
        }
      });
      config.validate();
      console.log(JSON.stringify(config, null, 4));
      fs.writeFileSync('oaica.json', JSON.stringify(config, null, 4));
      console.log(green('Config file written to oaica.json!'));
    });

program.command('wallet')
    .description('Check your balance and add funds.')
    .action(async () => {
      const config = Config.load('oaica.json');
      config.validate();

      const wallet = new SparkWallet(config.network === 'MAINNET' ? 0 : 1);
      await wallet.createSparkWallet(config.spark.mnemonic);
      await wallet.claimTransfers();

      const balance = await wallet.getBalance();
      console.log(`Current balance: ${balance}`);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      let amountSats = await new Promise<string>((resolve) => {
        rl.question('Enter the amount of sats you want to deposit: ', resolve);
      });
      const invoice = await wallet.createLightningInvoice({
        amountSats: parseInt(amountSats),
        expirySeconds: 6000,
        memo: 'Inference Grid Spark Wallet Deposit',
      })
      console.log(`Invoice created: ${invoice}`);

      const numChecks = 10;
      for (let i = 0; i < numChecks; i++) {
        console.log(`Checking for deposits (${i}/${numChecks})...`);
        await wallet.claimTransfers();
        await wallet.syncTokenLeaves();
        const newBalance = await wallet.getBalance();
        if (newBalance > balance) {
          console.log(`Deposit received!`);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      rl.close();
    });

program.command('serve [config]')
    .description('Serve the Inference Grid.')
    .action(async (path_to_config: string|undefined) => {
      if (!path_to_config) {
        path_to_config = 'oaica.json'
      }
      console.log(`Loading config: ${path_to_config}`);
      const config = Config.load(path_to_config);
      config.validate();
      console.log(JSON.stringify(config, null, 4));

      console.log('Testing connection to Inference Grid...');
      const socket = await createAuthenticatedSocket(config);
      socket.close();
      console.log(green('Connection successful!'));

      console.log('Initializing Spark wallet...');
      let wallet = new SparkWallet(1);
      await wallet.createSparkWallet(config.spark.mnemonic);
      const balance = await wallet.getBalance();
      console.log(`Balance: ${balance}`);

      async function payInvoice(invoice: string) {
        console.log(`Paying invoice ${invoice}...`);
        await wallet.payLightningInvoice({
          invoice: invoice,
        })
      }

      const app = express();
      app.use(express.json());
      console.log('Starting server...');

      app.use(
          (_req: express.Request, res: express.Response,
           next: express.NextFunction) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader(
                'Access-Control-Allow-Methods',
                'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader(
                'Access-Control-Allow-Headers',
                'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
          });

      app.get('/', (req: express.Request, res: express.Response) => {
        res.send('Hello, World!');
      });

      app.post(
          '/chat/completions',
          async (req: express.Request, res: express.Response) => {
            console.log(`Received request: ${JSON.stringify(req.body)}`);
            await handleRequest(config, req, res, payInvoice);
          });

      app.listen(config.port, () => {
        console.log(`Listening on port ${config.port}...`);
        console.log(
            'You can now use any OpenAI-compatible SDK to connect to this server.');
      });
    });

console.warn(red(
    '⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️'))
console.warn(red(
    'IMPORTANT: This is a pre-release version of the Inference Grid intended for testing purposes only.'))
console.warn(red(
    'This software is experimental and provided \'as is\' without any warranties or guarantees.'))
console.warn(red(
    '⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️'))
console.warn('')
program.parse(process.argv);