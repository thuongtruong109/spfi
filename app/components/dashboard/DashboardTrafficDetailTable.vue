<script setup lang="ts">
import { ArrowDown, ArrowUp, Search } from "@lucide/vue";
import type { DashboardTrafficDetailRow } from "~~/types/dashboard";

type DetailColumnKey = keyof DashboardTrafficDetailRow;
type DetailColumnFormat = "text" | "number" | "percent" | "duration";

interface DetailColumn {
  key: DetailColumnKey;
  label: string;
  format: DetailColumnFormat;
}

const props = defineProps<{
  rows: DashboardTrafficDetailRow[];
  limitReached?: boolean;
}>();

const { locale, t } = useLocalization();
const query = ref("");
const page = ref(1);
const pageSize = ref(25);
const sortKey = ref<DetailColumnKey>("sessions");
const sortDirection = ref<"asc" | "desc">("desc");

const columns = computed<DetailColumn[]>(() => [
  { key: "source", label: t("dashboard.trafficDetailSource"), format: "text" },
  {
    key: "referrerDomain",
    label: t("dashboard.trafficDetailReferrerDomain"),
    format: "text",
  },
  {
    key: "referrerTerms",
    label: t("dashboard.trafficDetailReferrerTerms"),
    format: "text",
  },
  { key: "country", label: t("dashboard.trafficDetailCountry"), format: "text" },
  {
    key: "countryCode",
    label: t("dashboard.trafficDetailCountryCode"),
    format: "text",
  },
  { key: "region", label: t("dashboard.trafficDetailRegion"), format: "text" },
  { key: "city", label: t("dashboard.trafficDetailCity"), format: "text" },
  { key: "browser", label: t("dashboard.trafficDetailBrowser"), format: "text" },
  {
    key: "browserVersion",
    label: t("dashboard.trafficDetailBrowserVersion"),
    format: "text",
  },
  {
    key: "operatingSystem",
    label: t("dashboard.trafficDetailOs"),
    format: "text",
  },
  {
    key: "operatingSystemVersion",
    label: t("dashboard.trafficDetailOsVersion"),
    format: "text",
  },
  {
    key: "deviceType",
    label: t("dashboard.trafficDetailDevice"),
    format: "text",
  },
  {
    key: "apiClient",
    label: t("dashboard.trafficDetailApiClient"),
    format: "text",
  },
  {
    key: "trafficType",
    label: t("dashboard.trafficDetailTrafficType"),
    format: "text",
  },
  {
    key: "platform",
    label: t("dashboard.trafficDetailPlatform"),
    format: "text",
  },
  { key: "channel", label: t("dashboard.trafficDetailChannel"), format: "text" },
  { key: "medium", label: t("dashboard.trafficDetailMedium"), format: "text" },
  {
    key: "landingPageType",
    label: t("dashboard.trafficDetailLandingType"),
    format: "text",
  },
  {
    key: "landingPagePath",
    label: t("dashboard.trafficDetailLandingPath"),
    format: "text",
  },
  {
    key: "campaign",
    label: t("dashboard.trafficDetailCampaign"),
    format: "text",
  },
  {
    key: "campaignContent",
    label: t("dashboard.trafficDetailCampaignContent"),
    format: "text",
  },
  {
    key: "aiReferral",
    label: t("dashboard.trafficDetailAiReferral"),
    format: "text",
  },
  {
    key: "sessions",
    label: t("dashboard.trafficSessions"),
    format: "number",
  },
  {
    key: "visitors",
    label: t("dashboard.trafficVisitors"),
    format: "number",
  },
  {
    key: "pageviews",
    label: t("dashboard.trafficPageviews"),
    format: "number",
  },
  {
    key: "pageviewsPerSession",
    label: t("dashboard.trafficDetailViewsPerSession"),
    format: "number",
  },
  {
    key: "bounces",
    label: t("dashboard.trafficDetailBounces"),
    format: "number",
  },
  {
    key: "bounceRate",
    label: t("dashboard.trafficDetailBounceRate"),
    format: "percent",
  },
  {
    key: "averageSessionDuration",
    label: t("dashboard.trafficDetailDuration"),
    format: "duration",
  },
  {
    key: "cartAdditions",
    label: t("dashboard.trafficFunnelCart"),
    format: "number",
  },
  {
    key: "reachedCheckouts",
    label: t("dashboard.trafficFunnelCheckout"),
    format: "number",
  },
  {
    key: "completedCheckouts",
    label: t("dashboard.trafficFunnelPurchase"),
    format: "number",
  },
  {
    key: "conversionRate",
    label: t("dashboard.trafficDetailConversionRate"),
    format: "percent",
  },
]);

const filteredRows = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase(locale.value);
  if (!normalized) return props.rows;
  return props.rows.filter((row) =>
    Object.values(row).some((value) =>
      String(value).toLocaleLowerCase(locale.value).includes(normalized),
    ),
  );
});

const sortedRows = computed(() =>
  [...filteredRows.value].sort((left, right) => {
    const leftValue = left[sortKey.value];
    const rightValue = right[sortKey.value];
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), locale.value, {
            numeric: true,
            sensitivity: "base",
          });
    return sortDirection.value === "asc" ? comparison : -comparison;
  }),
);

const pageCount = computed(() =>
  Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)),
);
const visibleRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return sortedRows.value.slice(start, start + pageSize.value);
});
const visibleStart = computed(() =>
  sortedRows.value.length ? (page.value - 1) * pageSize.value + 1 : 0,
);
const visibleEnd = computed(() =>
  Math.min(page.value * pageSize.value, sortedRows.value.length),
);

watch([query, pageSize, () => props.rows], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count);
});

function toggleSort(key: DetailColumnKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = typeof props.rows[0]?.[key] === "number" ? "desc" : "asc";
}

function ariaSort(key: DetailColumnKey) {
  if (sortKey.value !== key) return "none";
  return sortDirection.value === "asc" ? "ascending" : "descending";
}

function formatValue(value: string | number, format: DetailColumnFormat) {
  if (format === "number") {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
      Number(value),
    );
  }
  if (format === "percent") {
    return new Intl.NumberFormat(locale.value, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(Number(value));
  }
  if (format === "duration") {
    const seconds = Math.max(0, Math.round(Number(value)));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  }
  return String(value || "—");
}
</script>

<template>
  <section class="traffic-detail-card">
    <header class="traffic-detail-header">
      <div>
        <h3>{{ t("dashboard.trafficDetailTitle") }}</h3>
        <p>{{ t("dashboard.trafficDetailSubtitle") }}</p>
      </div>
      <span v-if="limitReached" class="traffic-detail-limit">
        {{ t("dashboard.trafficDetailLimited", { count: rows.length }) }}
      </span>
    </header>

    <div class="traffic-detail-toolbar">
      <label class="traffic-detail-search">
        <Search aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('dashboard.trafficDetailSearch')"
        />
      </label>
      <label class="traffic-detail-page-size">
        <span>{{ t("dashboard.trafficDetailRows") }}</span>
        <select v-model.number="pageSize">
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
    </div>

    <div v-if="rows.length" class="traffic-detail-scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ numeric: column.format !== 'text' }"
              :aria-sort="ariaSort(column.key)"
            >
              <button type="button" @click="toggleSort(column.key)">
                {{ column.label }}
                <ArrowUp
                  v-if="sortKey === column.key && sortDirection === 'asc'"
                  aria-hidden="true"
                />
                <ArrowDown v-else-if="sortKey === column.key" aria-hidden="true" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in visibleRows" :key="`${page}-${rowIndex}`">
            <td
              v-for="column in columns"
              :key="column.key"
              :class="{ numeric: column.format !== 'text' }"
              :title="column.format === 'text' ? String(row[column.key]) : undefined"
            >
              {{ formatValue(row[column.key], column.format) }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!visibleRows.length" class="traffic-detail-empty">
        {{ t("dashboard.trafficDetailNoMatches") }}
      </div>
    </div>
    <div v-else class="traffic-detail-empty">
      {{ t("dashboard.trafficDetailEmpty") }}
    </div>

    <footer v-if="rows.length" class="traffic-detail-footer">
      <span>
        {{
          t("dashboard.trafficDetailShowing", {
            start: visibleStart,
            end: visibleEnd,
            total: sortedRows.length,
          })
        }}
      </span>
      <div>
        <button type="button" :disabled="page <= 1" @click="page -= 1">
          {{ t("dashboard.trafficDetailPrevious") }}
        </button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button type="button" :disabled="page >= pageCount" @click="page += 1">
          {{ t("dashboard.trafficDetailNext") }}
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.traffic-detail-card {
  min-width: 0;
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
}

.traffic-detail-header,
.traffic-detail-toolbar,
.traffic-detail-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.traffic-detail-header {
  align-items: flex-start;
  margin-bottom: 12px;
}

.traffic-detail-header h3 {
  color: var(--text);
  font-size: 12px;
}

.traffic-detail-header p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.4;
}

.traffic-detail-limit {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 9px;
  font-weight: 700;
}

.traffic-detail-toolbar {
  margin-bottom: 10px;
}

.traffic-detail-search {
  display: flex;
  width: min(420px, 100%);
  min-height: 34px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-low);
}

.traffic-detail-search:focus-within {
  box-shadow: var(--focus-ring);
}

.traffic-detail-search svg {
  width: 14px;
  color: var(--muted);
}

.traffic-detail-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 11px;
}

.traffic-detail-page-size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 650;
}

.traffic-detail-page-size select {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
  color: var(--text);
  font: inherit;
}

.traffic-detail-scroll {
  position: relative;
  max-height: 620px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.traffic-detail-scroll table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.traffic-detail-scroll th,
.traffic-detail-scroll td {
  min-width: 110px;
  max-width: 220px;
  padding: 9px 10px;
  overflow: hidden;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-detail-scroll th {
  position: sticky;
  z-index: 2;
  top: 0;
  padding: 0;
  background: var(--surface-low);
}

.traffic-detail-scroll th:first-child,
.traffic-detail-scroll td:first-child {
  position: sticky;
  z-index: 1;
  left: 0;
  min-width: 145px;
}

.traffic-detail-scroll th:first-child {
  z-index: 3;
  background: var(--surface-low);
}

.traffic-detail-scroll tr:last-child td {
  border-bottom: 0;
}

.traffic-detail-scroll th:last-child,
.traffic-detail-scroll td:last-child {
  border-right: 0;
}

.traffic-detail-scroll th button {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
}

.traffic-detail-scroll th button:hover {
  color: var(--green);
}

.traffic-detail-scroll th button:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring);
}

.traffic-detail-scroll th svg {
  width: 11px;
  flex: 0 0 auto;
  color: var(--green);
}

.traffic-detail-scroll .numeric {
  min-width: 105px;
  text-align: right;
}

.traffic-detail-scroll .numeric button {
  text-align: right;
}

.traffic-detail-scroll tbody tr:hover td {
  background: var(--surface-soft);
}

.traffic-detail-footer {
  margin-top: 10px;
  color: var(--muted);
  font-size: 9px;
}

.traffic-detail-footer > div {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.traffic-detail-footer button {
  min-height: 29px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 650;
}

.traffic-detail-footer button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.traffic-detail-empty {
  display: grid;
  min-height: 150px;
  place-items: center;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 620px) {
  .traffic-detail-header,
  .traffic-detail-toolbar,
  .traffic-detail-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .traffic-detail-limit {
    align-self: flex-start;
  }

  .traffic-detail-page-size,
  .traffic-detail-footer > div {
    justify-content: space-between;
  }
}
</style>
