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

One GraphQL request executes bounded ShopifyQL queries for:

- Human sessions, unique online-store visitors, pageviews, bounces, completed
  checkouts, and average session duration for today, 7 days, and 30 days.
- Hourly sessions and visitors for the latest 24 hours.
- Daily sessions and visitors for the latest 30 days.
- Top referrer sources, countries, and device types for the latest 30 days.
- Per-store conversion funnel counts for cart additions, reached checkouts, and
  completed checkouts.
- Per-store acquisition details by traffic type, referring platform, browser,
  landing page, UTM campaign, and AI referring channel.
- A detailed per-store table of up to 250 aggregated combinations across
  referrer, geography, browser and OS versions, device, API client, traffic
  classification, landing page, UTM fields, and funnel metrics. Rows are ranked
  deterministically by sessions and can be searched, sorted, and paged locally.

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
  tab. If a newer dimension such as AI referrals is unavailable for the selected
  API version, that section stays empty without hiding the core traffic report.
- The detail table is aggregated; it deliberately excludes session identifiers
  and full referrer URLs. A 250-row cap keeps the report bounded and responsive.
