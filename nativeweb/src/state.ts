import {SparkWallet} from '@buildonspark/spark-sdk'
import {Network} from '@buildonspark/spark-sdk/utils'
import {reactive, watch} from 'vue'
import * as ed25519 from '@noble/ed25519';
import { sha512 } from "@noble/hashes/sha512";
import {Network as IGNetwork, Role, InferenceGridClient} from "spark-ig-sdk"

ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

const BASE_URL = import.meta.env.PROD ? 'wss://relay.inferencegrid.ai' :
                                        'ws://localhost:5001'

const state = reactive({
  initialized: false,
  balance: 0,

  // TODO: Build an UI for users to link their wallet!
  mnemonic:
      'tank hotel tip zoo raven wheat boy crush curious present trade butter',
})

let wallet = new SparkWallet(Network.REGTEST)
let client = new InferenceGridClient({
  "network": IGNetwork.REGTEST,
  "publicKey": "385bebd967fb73dacc872f9279dd69d8bed9e9cbadca15a20a70196f5a45fbee",
  "privateKey": "cfb02b6bdc0a7af386bb8f3a9d90b5b2fa720a23ebc4e452b5339561f1f98da3",
})

function refreshBalance() {
  if (state.mnemonic) {
    console.log('Creating wallet')
    wallet.initWallet(state.mnemonic).then(() => {
        console.log('Wallet initialized')
        wallet.getBalance(true).then((balance) => {
        state.balance = Number(balance.balance)
        state.initialized = true
            console.log('Balance', state.balance)
        })
    })
  }
}
watch(() => state.mnemonic, refreshBalance);
refreshBalance();

export {state, BASE_URL, refreshBalance, wallet, client, Role, IGNetwork}