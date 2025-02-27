<template>
  <SparkAppBar />
  <v-container style="max-width: 800px;">
    <v-row class="mt-2">
      <v-col>
        <v-text-field density="compact" v-model="inputText" label="Ask me anything..." variant="outlined"
          @keyup.enter="basicChat" append-inner-icon="mdi-send" @click:append-inner="basicChat"></v-text-field>
      </v-col>
    </v-row>
    <v-row class="mt-n4">
      <v-col>
        <v-card v-for="obj in historyReversed" :key="obj.input" class="mb-4">
          <v-card-item>
            <v-card-title>
              {{ obj.input }}
            </v-card-title>
          </v-card-item>
          <v-card-text>
            <div class="text-pre-wrap">{{ obj.output.trim() }}</div>
            <v-tooltip v-if="obj.invoice" text="Click to copy">
              <template v-slot:activator="{ props }">
                <v-chip v-bind="props" class="mt-4" variant="outlined" @click="copyInvoice(obj.invoice)">
                  <span class="mr-1" :class="{ 'text-error': obj.status === InvoiceStatus.ERROR, 'text-success': obj.status === InvoiceStatus.PAID }">
                    {{ obj.status }}
                  </span> |
                  <span class="ml-1">
                    {{ obj.invoice.substring(0, 30) + '...' }}
                  </span>
                </v-chip>
              </template>
            </v-tooltip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

</template>

<style scoped>
.text-pre-wrap {
  white-space: pre-wrap;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { wallet, state, refreshBalance, client, Role } from '../state';

const inputText = ref("");
const loading = ref(false);
const history = ref([] as any);

enum InvoiceStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  ERROR = "ERROR",
}

const historyReversed = computed(() => {
  return history.value.slice().reverse();
});

function basicChat() {
  if (inputText.value.trim() === "") {
    return;
  }
  if (!state.initialized) {
    alert("Your wallet is not initialized yet!.");
    return;
  }
  if (state.balance == 0) {
    alert("Your wallet has no balance!.");
    return;
  }

  const obj = {} as any;
  obj.input = inputText.value;
  obj.output = "";
  obj.invoice = "";
  obj.status = InvoiceStatus.PENDING;
  history.value.push(obj);
  const idx = history.value.length - 1;

  function onUpdate(message: string) {
    history.value[idx].output += message;
  }

  function onComplete(invoice?: string) {
    loading.value = false;
    if (invoice) {
      history.value[idx].invoice = invoice;
      wallet.payLightningInvoice({
        invoice: invoice,
      }).then((result) => {
        console.log(result);
        history.value[idx].status = InvoiceStatus.PAID;
        setTimeout(() => {
          refreshBalance();
        }, 1000);
      }).catch((error) => {
        console.error(error);
        history.value[idx].status = InvoiceStatus.ERROR;
      });
    }
  }

  client.chat([
    {
      role: Role.USER,
      content: obj.input
    }], {
    maxTokens: 1000,
    temperature: 0.9,
    tierSelector: '>3',
    flags: [],
  }, onUpdate, onComplete);
}

function copyInvoice(invoice: string) {
  navigator.clipboard.writeText(invoice);
}
</script>