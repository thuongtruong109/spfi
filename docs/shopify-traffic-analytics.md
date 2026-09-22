# Shopify traffic analytics

The aggregate dashboard and the per-shop `/store?tab=traffic` view read official
Shopify Analytics data through the Admin GraphQL API's `shopifyqlQuery` field
and the ShopifyQL `sessions` dataset.

## Requirements

- Admin GraphQL API version `2025-10` or newer. This project defaults to
  `2026-07`.
- The app version must include the `read_reports` access scope.
- Shopify must approve Level 2 protected customer data access for the app.
- After changing app scopes, release the app version and rotate each saved
  store's access token from Manager.

The setup guide already includes `read_reports` in its scope list. A store that
does not satisfy all requirements still loads its other data and shows a
traffic-specific warning in the dashboard and Traffic tab.

## Data shown

The overview GraphQL request executes bounded ShopifyQL queries for:

- Human sessions, unique online-store visitors, pageviews, bounces, completed
  checkouts, and average session duration for today, 7 days, and 30 days.
- Hourly sessions and visitors for the latest 24 hours.
- Daily sessions and visitors for the latest 30 days.
- Top referrer sources, countries, and device types for the latest 30 days.
- Per-store conversion funnel counts for cart additions, reached checkouts, and
  completed checkouts.

The per-store Traffic tab loads one additional ShopifyQL query only for the
selected 24-hour, 7-day, or 30-day range. That request returns acquisition
details by traffic type, referring platform, browser, landing page, UTM
campaign, and AI referring channel:

- Up to 250 aggregated combinations across referrer, geography, browser and OS
  versions, device, API client, traffic classification, landing page, UTM
  fields, and funnel metrics. The per-store dashboard regroups those rows into
  acquisition, audience, technology, and content/campaign cards, each with a
  distribution chart and expandable metric table.

The 7-day and 30-day unique visitor totals are queried directly for their full
period. They are never calculated by adding daily unique visitor rows.

## Semantics and limitations

- The dashboard excludes rows classified by Shopify as bot sessions.
- This is Shopify Analytics reporting, not the Shopify Admin Live View count of
  visitors active right now.
- Today's period is in progress and may change after refresh.
- Shopify Analytics can lag behind storefront activity.
- Sessions depend on Shopify's privacy, visitor-identification, and cookie
  consent rules. They are not raw HTTP requests.
- Cross-store totals add the independent totals reported by each store; they do
  not deduplicate the same person across different stores.
- Extended acquisition dimensions are queried only for the per-store Traffic
  tab and cached independently by selected range. If a detail query is
  unavailable, throttled, or too large, the tab shows a detail-specific warning
  without hiding the core traffic report.
- Shopify GraphQL can return valid data and field-level errors in the same
  response. The traffic parser keeps every valid summary alias and falls back
  only the failed chart or breakdown, so one unsupported dimension cannot mark
  the entire report unavailable.
- The detailed dimensions are aggregated; they deliberately exclude session
  identifiers and full referrer URLs. A 250-row source cap keeps the report
  bounded and responsive.
