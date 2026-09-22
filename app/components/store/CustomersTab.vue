<template>
  <div class="customer-page">
    <div class="page-toolbar">
      <div>
        <div class="page-meta">
          <template v-if="activeQuery">
            {{ customers.length }} matching customer{{
              customers.length === 1 ? "" : "s"
            }}
          </template>
          <template v-else>
            {{ totalCount }} customer{{ totalCount === 1 ? "" : "s" }}
          </template>
        </div>
        <div v-if="activeQuery" class="search-summary">
          Results for “{{ activeQuery }}”
        </div>
      </div>

      <label class="customer-search">
        <span class="sr-only">Search customers</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m12.5 12.5 4 4" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Name, email, phone, tag…"
        />
      </label>
    </div>

    <StoreCustomerManagementPanel />

    <div
      v-if="isLoading && !customers.length"
      class="state-message is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>Loading customers…</span>
    </div>
    <div v-else-if="error && !customers.length" class="state-message is-error">
      {{ error }}
    </div>
    <template v-else>
      <div v-if="error" class="inline-error">{{ error }}</div>

      <div class="card table-card">
        <div ref="customerList" class="table-scroll" @scroll="updateCustomerViewport">
          <table class="customers-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Marketing</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="customerPaddingTop" class="virtual-spacer" aria-hidden="true">
                <td :style="{ height: `${customerPaddingTop}px` }" colspan="6" />
              </tr>
              <tr
                v-for="{ item: customer } in visibleCustomers"
                :key="customer.id"
                class="customer-row"
                :class="{
                  'is-selected': customer.id === selectedCustomer?.id,
                }"
                @click="customer.id && selectCustomer(customer.id)"
              >
                <td>
                  <div class="customer-cell">
                    <span class="avatar">{{ getInitials(customer) }}</span>
                    <span>
                      <strong>{{ getCustomerName(customer) }}</strong>
                      <small>{{
                        customer.email || customer.phone || "No contact"
                      }}</small>
                    </span>
                  </div>
                </td>
                <td>{{ getCustomerLocation(customer) }}</td>
                <td>{{ customer.orders_count ?? 0 }}</td>
                <td>{{ formatTotalSpent(customer) }}</td>
                <td>
                  <span
                    class="status-pill"
                    :class="{
                      'is-subscribed':
                        customer.email_marketing_consent?.state === 'subscribed',
                    }"
                  >
                    {{
                      customer.email_marketing_consent?.state === "subscribed"
                        ? "Subscribed"
                        : "Not subscribed"
                    }}
                  </span>
                </td>
                <td>{{ formatDate(customer.updated_at) }}</td>
              </tr>
              <tr
                v-if="customerPaddingBottom"
                class="virtual-spacer"
                aria-hidden="true"
              >
                <td :style="{ height: `${customerPaddingBottom}px` }" colspan="6" />
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!customers.length" class="empty-state">No customers found.</div>
      </div>

      <section
        v-if="selectedCustomer || isLoadingDetail"
        class="card detail-card"
        aria-live="polite"
      >
        <div v-if="isLoadingDetail" class="state-message is-loading" role="status">
          <ApiLoadingIcon variant="section" aria-hidden="true" />
          <span>Loading customer detail and orders…</span>
        </div>
        <template v-else-if="selectedCustomer">
          <header class="detail-header">
            <div class="customer-cell">
              <span class="avatar is-large">
                {{ getInitials(selectedCustomer) }}
              </span>
              <span>
                <span class="detail-kicker">Customer detail</span>
                <h2>{{ getCustomerName(selectedCustomer) }}</h2>
              </span>
            </div>
            <BaseButton
              variant="ghost"
              icon-only
              aria-label="Close customer detail"
              @click="clearSelection"
            >
              <template #icon><X aria-hidden="true" /></template>
            </BaseButton>
          </header>

          <div class="detail-grid">
            <div>
              <span>Contact</span>
              <strong>{{ selectedCustomer.email || "—" }}</strong>
              <small>{{ selectedCustomer.phone || "No phone" }}</small>
            </div>
            <div>
              <span>Default address</span>
              <strong>{{ getCustomerLocation(selectedCustomer) }}</strong>
              <small>{{
                selectedCustomer.default_address?.address1 || "No address"
              }}</small>
            </div>
            <div>
              <span>Customer since</span>
              <strong>{{ formatDate(selectedCustomer.created_at) }}</strong>
              <small>{{ selectedCustomer.state || "Unknown state" }}</small>
            </div>
            <div>
              <span>Lifetime value</span>
              <strong>{{ formatTotalSpent(selectedCustomer) }}</strong>
              <small> {{ selectedCustomer.orders_count ?? 0 }} total orders </small>
            </div>
          </div>

          <div class="orders-section">
            <div class="section-heading">
              <h3>Orders</h3>
              <span>{{ selectedCustomerOrders.length }} loaded</span>
            </div>
            <div v-if="selectedCustomerOrders.length" class="orders-list">
              <NuxtLink
                v-for="order in selectedCustomerOrders"
                :key="order.id"
                class="order-item"
                :to="{
                  path: `/order/${order.id}`,
                  query: { shop: formStore.storeId },
                }"
              >
                <span>
                  <strong>{{ order.name || `#${order.order_number}` }}</strong>
                  <small>{{ formatDate(order.created_at) }}</small>
                </span>
                <span class="order-total">
                  {{ formatOrderTotal(order.total_price, order.currency) }}
                </span>
              </NuxtLink>
            </div>
            <div v-else class="empty-orders">This customer has no orders.</div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { X } from "@lucide/vue";
import { useCustomers } from "~/composables/useCustomers";
import { useFormStore } from "~/stores/form";
import type { ShopifyCustomer } from "~~/types/shopify";

const formStore = useFormStore();
const {
  customers,
  selectedCustomer,
  selectedCustomerOrders,
  activeQuery,
  totalCount,
  searchQuery,
  isLoading,
  isLoadingDetail,
  error,
  search,
  selectCustomer,
  clearSelection,
} = useCustomers();

useDebouncedWatch(
  searchQuery,
  (query) => {
    if (query.trim() !== activeQuery.value) return search(query);
  },
  350,
);

const {
  container: customerList,
  paddingBottom: customerPaddingBottom,
  paddingTop: customerPaddingTop,
  updateViewport: updateCustomerViewport,
  visibleItems: visibleCustomers,
} = useVirtualList(customers, {
  itemHeight: 59,
  overscan: 6,
  defaultViewportHeight: 560,
});

function getCustomerName(customer: ShopifyCustomer) {
  return (
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email ||
    `Customer #${customer.id}`
  );
}

function getInitials(customer: ShopifyCustomer) {
  const initials = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .map((part) => String(part).charAt(0))
    .join("");

  return (initials || customer.email?.charAt(0) || "?").toUpperCase();
}

function getCustomerLocation(customer: ShopifyCustomer) {
  const address = customer.default_address;

  return (
    [address?.city, address?.province_code, address?.country_code]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

function formatTotalSpent(customer: ShopifyCustomer) {
  return formatOrderTotal(customer.total_spent || "0", customer.currency);
}

function formatOrderTotal(value: string, currency = "USD") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return value;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}
</script>

<style scoped>
.customer-page {
  display: grid;
  gap: 18px;
}

.page-toolbar,
.detail-header,
.section-heading,
.order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-meta,
.search-summary {
  color: var(--text-sub);
  font-size: 13px;
}

.search-summary {
  margin-top: 3px;
}

.customer-search {
  display: flex;
  width: min(330px, 100%);
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 11px;
  background: var(--surface);
  color: var(--text-sub);
}

.customer-search:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(31, 122, 77, 0.12);
}

.customer-search input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.table-card {
  overflow: hidden;
}

.table-scroll {
  max-height: min(62vh, 620px);
  overflow: auto;
}

.customers-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.customers-table th,
.customers-table td {
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  color: var(--text);
  font-size: 13px;
  vertical-align: middle;
}

.customers-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-weight: 600;
}

.virtual-spacer td {
  padding: 0;
  border: 0;
}

.customer-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.customer-row:hover,
.customer-row.is-selected {
  background: var(--green-soft);
}

.customer-cell {
  display: flex;
  align-items: center;
  gap: 11px;
}

.customer-cell > span:last-child,
.order-item > span {
  display: grid;
  gap: 2px;
}

.customer-cell small,
.order-item small,
.detail-grid small {
  color: var(--text-sub);
  font-size: 12px;
}

.avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 12px;
  font-weight: 600;
}

.avatar.is-large {
  width: 46px;
  height: 46px;
  font-size: 15px;
}

.status-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}

.status-pill.is-subscribed {
  background: var(--green-soft);
  color: var(--green);
}

.state-message,
.empty-state,
.empty-orders {
  padding: 42px 18px;
  color: var(--text-sub);
  text-align: center;
}

.state-message.is-error,
.inline-error {
  color: var(--red);
}

.state-message.is-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.inline-error {
  border: 1px solid rgba(180, 49, 43, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--red-soft);
  font-size: 13px;
}

.detail-card {
  overflow: hidden;
}

.detail-header {
  border-bottom: 1px solid var(--border);
  padding: 18px;
}

.detail-kicker {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.detail-header h2 {
  color: var(--text);
  font-size: 18px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-bottom: 1px solid var(--border);
  background: var(--border);
}

.detail-grid > div {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 16px;
  background: var(--surface);
}

.detail-grid span {
  color: var(--text-sub);
  font-size: 12px;
}

.detail-grid strong {
  overflow: hidden;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orders-section {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.section-heading h3 {
  color: var(--text);
  font-size: 15px;
}

.section-heading span {
  color: var(--text-sub);
  font-size: 12px;
}

.orders-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.order-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 11px 13px;
  color: var(--text);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.order-item:hover {
  border-color: rgba(31, 122, 77, 0.4);
  background: var(--green-soft);
}

.order-total {
  color: var(--green);
  font-weight: 600;
}

.empty-orders {
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .page-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .customer-search {
    width: 100%;
  }

  .detail-grid,
  .orders-list {
    grid-template-columns: 1fr;
  }
}
</style>
