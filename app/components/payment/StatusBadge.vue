<script setup lang="ts">
import { useLocalization } from "~/composables/useLocalization";
import { useShopifyPaymentLabel } from "~/composables/useShopifyPaymentLabel";

defineProps<{ status: string }>();

const { t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();
</script>

<template>
  <span class="payout-status" :data-status="status">
    {{ status === "paid" ? t("payment.deposited") : formatPaymentLabel(status) }}
  </span>
</template>

<style scoped>
.payout-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  white-space: nowrap;
  background: var(--amber-soft);
  color: var(--amber);
}

.payout-status[data-status="paid"] {
  background: var(--green-soft);
  color: var(--green);
}

.payout-status[data-status="in_transit"] {
  background: var(--blue-soft);
  color: var(--blue);
}

.payout-status[data-status="failed"] {
  background: var(--red-soft);
  color: var(--red);
}

.payout-status[data-status="canceled"] {
  background: var(--surface-soft);
  color: var(--text-sub);
}
</style>
