import {toReactive, useStorage} from '@vueuse/core'
import {SparkWallet} from 'spark-sdk'
import {watch} from 'vue'

const BASE_URL = import.meta.env.PROD ? 'wss://relay.inferencegrid.ai' :
                                        'ws://localhost:5001'

const state = toReactive(useStorage(
    'igrid', {
      mnemonic:
          'matrix ticket system stool proof cruise endorse pig logic online surge dust',
      balance: 0,
    },
    sessionStorage))

let wallet = new SparkWallet(1)

function refreshBalance() {
  if (state.mnemonic) {
        wallet.createSparkWallet(state.mnemonic).then(() => {
            console.log('created wallet')
            wallet.getBalance().then((balance) => {
                state.balance = Number(balance)
                console.log('balance', state.balance)
            })
            wallet.claimTransfers().then(() => {
                console.log('claimed transfers')
                wallet.getBalance().then((balance) => {
                    state.balance = Number(balance)
                    console.log('balance', state.balance)
                })
            })
        })
  }
}
watch(() => state.mnemonic, refreshBalance);
refreshBalance();

export {state, BASE_URL, refreshBalance, wallet}