<template>
    <v-app-bar :elevation="0">
        <v-app-bar-title>
            <template v-if="smAndDown">
                Demo
            </template>
            <template v-else>
                Native Web Demo
            </template>
        </v-app-bar-title>
        <v-spacer></v-spacer>
        <v-hover v-if="state.mnemonic">
            <template v-slot:default="{ isHovering, props }">
                <v-chip color="white" v-bind="props" class="mr-4 wallet-chip" @click="dialog = true">
                    <template v-if="isHovering">
                        <v-icon icon="mdi-wallet" size="large" start />
                        Wallet
                    </template>
                    <template v-else>
                        <template v-if="state.initialized">
                            <v-icon icon="custom:sats" size="small" start />
                            {{ state.balance }} sats
                        </template>
                        <template v-else>
                            <v-progress-circular indeterminate color="white" size="14" />
                        </template>
                    </template>
                </v-chip>
            </template>
        </v-hover>
    </v-app-bar>

    <v-dialog v-model="dialog" width="400">
        <v-card>
            <v-card-item>
                <v-card-title class="text-h5 text-center">
                    Spark Wallet
                </v-card-title>
            </v-card-item>
            <v-card-text>
                <p class="text-center text-body-1">
                    Your Spark Wallet is compatible with any Lightning-enabled Bitcoin wallet.
                </p>

                <template v-if="screen === 'wallet'">
                    <div class="text-center py-12">
                        <p class="text-h2">
                            {{ state.balance }}
                        </p>
                        <p class="text-h6">
                            sats
                        </p>
                    </div>
                    <v-btn block elevation="0" color="primary" @click="screen = 'send'">
                        Send
                    </v-btn>
                    <div class="py-1" />
                    <v-btn block elevation="0" color="white" variant="outlined" @click="screen = 'receive'">
                        Receive
                    </v-btn>
                </template>

                <template v-else-if="screen === 'send'">
                    <div class="text-center pt-6">
                        <v-text-field label="Lightning Invoice" placeholder="lnbc1..." v-model="invoiceToPay" variant="outlined" />
                    </div>
                    <v-btn block elevation="0" color="primary" :disabled="!invoiceToPay" @click="payInvoice()">
                        Pay Invoice
                    </v-btn>
                    <div class="py-1" />
                    <v-btn block elevation="0" variant="text" @click="screen = 'wallet'">
                        <v-icon icon="mdi-arrow-left" size="small" start />
                        Back
                    </v-btn>
                </template>

                <template v-else-if="screen === 'receive'">
                    <template v-if="!invoice && !loading">
                        <div class="text-center py-12 mt-n8">
                            <v-text-field variant="plain" type="number" v-model="amount"
                                class="giant-input"></v-text-field>
                            <p class="text-h6 mt-n10">
                                sats
                            </p>
                        </div>
                        <v-btn block elevation="0" color="primary" @click="generateInvoice()">
                            Create Invoice
                        </v-btn>
                        <div class="py-1" />
                        <v-btn block elevation="0" variant="text" @click="screen = 'wallet'">
                            <v-icon icon="mdi-arrow-left" size="small" start />
                            Back
                        </v-btn>
                    </template>

                    <template v-else-if="loading">
                        <div class="text-center py-12">
                            <v-progress-circular indeterminate color="primary" />
                        </div>
                    </template>

                    <template v-else>
                        <div class="text-center py-4">
                            <vue-qrcode :value="invoice" :options="{ width: 300, height: 300 }" />
                            <div class="d-flex align-center text-body-2 px-12">
                                <span class="text-truncate">{{ invoice }}</span>
                                <v-icon icon="mdi-content-copy" size="small" @click="copyInvoice()" class="ms-2" />
                            </div>
                        </div>
                        <div class="py-1" />
                        <v-btn block elevation="0" variant="text" @click="dialog = false">
                            Done
                        </v-btn>
                    </template>
                </template>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { wallet, state, refreshBalance } from '@/state';
import VueQrcode from '@chenfengyuan/vue-qrcode';
import { useDisplay } from 'vuetify'

const { smAndDown } = useDisplay()

type Screen = "wallet" | "send" | "receive";

const dialog = ref(false);
const screen = ref<Screen>("wallet");
const invoice = ref("");
const loading = ref(false);
const amount = ref(0);
const invoiceToPay = ref("");

const copyInvoice = () => {
    navigator.clipboard.writeText(invoice.value);
};

const payInvoice = () => {
    wallet.payLightningInvoice({
        invoice: invoiceToPay.value,
    }).then((obj) => {
        console.log(obj);
        alert("Invoice paid!");
        dialog.value = false;
    }).catch((err) => {
        alert(err.message);
    }).finally(() => {
        refreshBalance();
    })
};

const generateInvoice = () => {
    if (amount.value < 1) {
        alert("Amount must be greater than 0");
        return;
    }
    loading.value = true;
    wallet.createLightningInvoice({
        amountSats: parseInt(amount.value as any),
        memo: "Inference Grid Web Demo",
    }).then((obj) => {
        invoice.value = obj;
    }).finally(() => {
        loading.value = false;
    });
};

watch(() => dialog.value, () => {
    screen.value = "wallet";
    amount.value = 0;
    invoice.value = "";
});

watch(() => screen.value, () => {
    amount.value = 0;
    invoice.value = "";
});
</script>

<style scoped>
.wallet-chip {
    min-width: 120px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
}

.giant-input :deep(input) {
    font-size: 64px;
    text-align: center;
    font-weight: 300;
    font-family: Roboto, sans-serif;
}

.giant-input :deep(input::-webkit-outer-spin-button),
.giant-input :deep(input::-webkit-inner-spin-button) {
    -webkit-appearance: none;
    margin: 0;
}
</style>