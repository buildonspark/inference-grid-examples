import {SparkWallet} from '@buildonspark/spark-sdk'
import {Network} from '@buildonspark/spark-sdk/utils'
import {reactive, watch} from 'vue'

const BASE_URL = import.meta.env.PROD ? 'wss://relay.inferencegrid.ai' :
                                        'ws://localhost:5001'

const state = reactive({
  mnemonic: 'juice improve tooth asthma hundred turn exile wood salon sibling creek wrap',
  balance: 0,
})

let wallet = new SparkWallet(Network.REGTEST)

function refreshBalance() {
  if (state.mnemonic) {
        wallet.initWallet(state.mnemonic).then(() => {
            console.log('created wallet')
            wallet.getBalance().then((balance) => {
                state.balance = Number(balance.balance)
                console.log('balance', state.balance)
            })
        })
  }
}
watch(() => state.mnemonic, refreshBalance);
refreshBalance();

export {state, BASE_URL, refreshBalance, wallet}