<p align="center">
  <img src="./public/banner.png" alt="SPFI Shopify Operations Console" width="100%" />
</p>

<h1 align="center">SPFI</h1>

<p align="center">
  A compact Shopify operations console for setup, token rotation, Google Sheets lookup, payments, orders, products, and storefront status checks.
</p>

<p align="center">
  <img alt="Nuxt 4" src="https://img.shields.io/badge/Nuxt_4-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-42B883?style=for-the-badge&logo=vuedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Pinia" src="https://img.shields.io/badge/Pinia-FFD859?style=for-the-badge&logo=pinia&logoColor=14221B" />
  <img alt="Google Sheets" src="https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white" />
  <img alt="Node 24" src="https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
</p>

## Highlights

- One desk for Shopify setup, profile management, product operations, payments, order inspection, sheet lookup, and storefront checks.
- Nitro server routes keep Shopify, proxy, status, and Google Sheets calls behind the app surface.
- Proxy-aware status checking supports direct, shared proxy, and per-row proxy modes.
- Local-first shop profile workflows help reduce repeated credential and token handling.
- Store Operations groups draft orders, discounts, abandoned checkout recovery, and returns into one per-store queue.
- Shopify Markets auditing covers buyer conditions, currency and price inclusion, catalogs, localized URLs, market-driven shipping, and country resolution.
- Automatic tracking uses Tracktaco API v2's search-and-reveal workflow, then submits the revealed tracking number to Shopify fulfillment.

## Core Workflows

| Route        | Workflow        | What it does                                                                                                                       |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/setup`     | Setup Guide     | Documents the Shopify custom app setup flow and required access scopes.                                                            |
| `/manager`   | Shop Management | Stores Shopify credentials locally, tests proxies, and generates or rotates access tokens.                                         |
| `/store`     | Store Console   | Opens one saved store profile with tabs for transactions, payouts, disputes, orders, products, customers, markets, and operations. |
| `/dashboard` | Dashboard       | Aggregates revenue, traffic, fulfillment, customer, product, and payment signals across saved stores.                              |
| `/payment`   | Payments        | Reads Shopify Payments payouts, balance transactions, orders, and related product data through server APIs.                        |
| `/status`    | Status Checker  | Batch-checks Shopify storefront availability with direct, common-proxy, or per-row proxy modes.                                    |
| `/settings`  | Settings        | Manages Tracktaco, Google Sheets, cache retention, and per-store Shopify webhook diagnostics.                                      |

## Tech Stack

- Nuxt 4, Vue 3, and TypeScript for the application shell.
- Nitro server routes for Shopify, proxy, status, and Google Sheets APIs.
- Pinia for app stores and shared operational state.
- Google Sheets API via `googleapis`.
- SOCKS/HTTP proxy support via `socks-proxy-agent` and `https-proxy-agent`.

## Quick Start

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Configuration

### Browser origin policy

API requests are same-origin by default. If a separate trusted browser UI must
call the API, allow its exact origins as a comma-separated list:

```text
NUXT_ALLOWED_ORIGINS=https://ops.example.com,https://admin.example.com
```

Unsafe API methods reject requests without an `Origin` header unless the
browser supplies `Sec-Fetch-Site: same-origin`. An Origin is reflected in CORS
headers only when it is explicitly listed in `NUXT_ALLOWED_ORIGINS`.
Host-header origin fallback is off in production; enable
`NUXT_ALLOW_HOST_ORIGIN_FALLBACK=true` only for a known legacy local client.

Copy `.env.example` to `.env` as a starting point.

Shopify Admin REST and GraphQL requests share a runtime-configured API version.
The default is `2026-07`; after validating the next quarterly release and once
it is stable, rotate it without rebuilding the app, for example:

```text
NUXT_ADMIN_API_VERSION=2026-10
```

Add the Google service account file:

```text
server/service_account.json
```

The file must include `client_email` and `private_key`. Share any target spreadsheets with the service account email before using the Sheets workflow.

Required local inputs:

- Node.js 24.x (the same major used by Docker and CI).
- npm 10 or newer.
- A Google service account JSON file for Sheets features.
- Shopify store credentials for authenticated store operations.

Shopify Admin requests are throttled from Shopify's own response metadata, not
from a hard-coded store plan. REST requests honor `Retry-After` and share the
upstream bucket state per app/store; GraphQL retries use
`extensions.cost.throttleStatus.currentlyAvailable` and `restoreRate`.

### Real-time Shopify webhooks

For each connected store, the app registers shop-scoped GraphQL webhook
subscriptions for orders, fulfillments, refunds, Shopify Payments disputes,
products, inventory-level updates, and new customers. Topics for which a store's
token lacks the required Shopify scope are reported as registration warnings.
Shopify deliveries are accepted at
`POST /api/webhooks/shopify`, verified against the exact raw request body with
the store's client secret, durably claimed and deduplicated by
`X-Shopify-Webhook-Id`, persisted as idempotent per-delivery records, and streamed
to signed-in browser sessions over server-sent events. A received event updates
the notification menu and triggers one debounced dashboard refresh. Processing
leases expire after a crash so Shopify retries can take over instead of leaving a
delivery permanently locked.

The receiver must be reachable by Shopify over public HTTPS. Set an explicit
origin when the browser-facing origin is not the callback origin (for example,
when using a tunnel):

```text
NUXT_WEBHOOK_PUBLIC_URL=https://ops.example.com
```

Set a stable encryption key in production so per-store HMAC secrets can be
reloaded safely after a server restart:

```text
NUXT_WEBHOOK_ENCRYPTION_KEY=replace-with-a-long-random-deployment-secret
```

Without that key, secrets stay in process memory only and are rehydrated when a
browser with saved store credentials reconnects. Recent notifications and the
delivery deduplication window use Nitro storage at
`NITRO_WEBHOOK_STORAGE_PATH` (default `.data/webhooks`). Docker Compose mounts
this path on the `webhook-data` volume. Settings reports encrypted records that
the current key can no longer decrypt; restore the previous key or re-register
every affected store after an intentional key rotation.

The filesystem driver is appropriate for one app instance. For horizontal
scaling, point every replica at the same Redis database:

```text
NITRO_WEBHOOK_REDIS_URL=redis://redis.internal:6379
NITRO_WEBHOOK_REDIS_PREFIX=spf:webhooks
```

When Redis is configured, it replaces the filesystem webhook mount. SSE streams
poll the shared event records in addition to receiving low-latency local publish
events, so a webhook accepted by one replica reaches subscribers connected to
another replica. The Settings webhook panel shows the callback URL, each Shopify
subscription, receiver-observed delivery health, a local end-to-end pipeline test,
and an unregister action. Shopify Admin GraphQL 2026-07 does not expose per-
subscription delivery status or a webhook-test mutation, so those diagnostics
come from the receiver rather than unsupported schema fields.

Status and initial registration inspect stores with bounded concurrency. Expected
Shopify connectivity, proxy, token, scope, and callback-configuration failures are
returned as per-store diagnostics instead of generating a burst of development
error pages; a failed synchronization remains retryable and does not prevent an
already-registered store from connecting to the local notification stream.

Expiring Shopify client-credential tokens rotate automatically in the browser.
The scheduler derives each deadline from the saved `expiresTime`, refreshes
before expiry with deterministic jitter, rechecks when the tab becomes visible,
and uses a short localStorage lease so only one open tab rotates a store at a
time. Manager's manual rotate action remains available for operator-initiated
recovery.

### Data access endpoints

Order lists use Shopify cursor pagination end to end. `POST /api/order/all`
returns one page at a time:

```json
{
  "orders": [],
  "pageInfo": {
    "nextCursor": null,
    "previousCursor": null,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Pass a returned cursor as `query.page_info`; cursor requests intentionally drop
filters that Shopify does not permit alongside `page_info`.

`POST /api/graphql` provides a generic Admin GraphQL read endpoint for nested
data. It accepts `{ storeId, token, query, variables?, operationName? }` and
returns `{ data }`. This endpoint is deliberately read-only: mutations,
subscriptions, schema introspection, oversized inputs, and excessively nested
queries are rejected.

CSV downloads are available from `POST /api/export/csv/:resource`, where
`resource` is `orders`, `products`, or `payments`. Pages are written to a
temporary UTF-8 CSV first, so an upstream pagination failure can still return a
non-200 response; the completed file is then streamed and removed. CSV values
are protected against spreadsheet formula injection. The store UI exposes the
same exports through reusable buttons.

`/dashboard` is an all-store operational view. The browser loads saved stores
with a concurrency limit and calls `POST /api/dashboard` once per store. Each
response aggregates the current calendar month's orders, daily revenue, top
products, pending fulfillments, customer and product totals, Shopify Payments,
staff access, and ShopifyQL traffic analytics. Traffic includes human sessions,
unique visitors, pageviews, 24-hour and 30-day trends, plus source, country, and
device breakdowns. It requires `read_reports`, Level 2 protected customer data
access, and Admin GraphQL API `2025-10` or newer. Traffic permission failures
degrade to a per-store warning and do not hide the other metrics. See
`docs/shopify-traffic-analytics.md` for the query and metric semantics.

The same Shopify Analytics report is available for the currently selected shop
from `/store?tab=traffic`. Traffic snapshots are cached independently per shop,
so switching the store selector never mixes traffic between stores and Refresh
reloads only the active shop.
The per-shop tab also includes a 30-day conversion funnel plus traffic type,
referring platform, AI referral, landing page, UTM campaign, and browser
breakdowns. These extended queries are not run for every shop on the aggregate
dashboard.

Financial totals remain separated by currency, date boundaries follow
the viewer's timezone, and restricted resources degrade independently instead
of hiding the rest of a store's dashboard. Dashboard snapshots live in Pinia and
respect the configurable data-retention lifetime, so keep-alive navigation does
not repeat network requests. The page also supports store/currency filters,
debounced search, interactive ranking controls, and CSV, TSV, JSON, or printable
HTML exports of the current filtered view.

The optional local per-IP limits are disabled by default so they don't reduce
Shopify throughput. A deployment that exposes the server publicly can enable
them without changing source code:

```text
NUXT_API_RATE_LIMIT_PER_MINUTE=600
NUXT_TOKEN_RATE_LIMIT_PER_MINUTE=10
```

These fail-closed defaults apply even when the variables are omitted. Raise
them deliberately for trusted high-volume deployments.

Forwarded client IP headers are ignored by default. Set
`NUXT_TRUST_PROXY_HEADERS=true` only behind a trusted reverse proxy that
overwrites `X-Forwarded-For`; the bundled nginx and Compose configuration do.

Automatic tracking is configured from `/settings`. The app uses Tracktaco API
v2 on `https://v2.tracktaco.com`: it searches candidate tracking numbers for
free, reveals one matching candidate with the saved Bearer API key, and then
passes that tracking number and carrier URL to Shopify's fulfillment flow. The
API key is saved in browser-local storage; no PIN/password unlock or Tracktaco
`.env` values are required. See `docs/tracktaco-v2.md` for the exact request
contract.

The same page controls how long Shopify operational data stays reusable in
Pinia. Presets range from no cache through one day to the default session mode,
which keeps data until the browser page is refreshed. Only this preference is
persisted; the Shopify response data remains in memory.

### Store Operations

The store page's Operations tab exposes one scoped queue for work that lives
outside a single order detail page:

- Draft orders: load, review, and complete recent draft orders.
- Discounts: create basic amount, percentage, and free-shipping promotions.
- Abandoned checkouts: read recent abandoned checkouts and copy Shopify-hosted
  recovery URLs. The GraphQL query sorts with the supported
  `AbandonedCheckoutSortKeys.UPDATED_AT` enum and requires both `read_orders`
  and Shopify's `manage_abandoned_checkouts` staff permission.
- Returns: read and manage return lifecycle actions where the store token has
  the required return scopes.

See `docs/shopify-commerce-operations.md` for endpoint and scope details.

### Shopify Markets

The Markets tab uses the Admin GraphQL 2026-07 Markets model. It reads
country/subdivision buyer conditions from the non-deprecated conditions tree,
shows currency, price inclusion, catalogs, localized URLs and market-driven
shipping, resolves the effective buyer experience for a country, and allows a
confirmed Active/Draft status change.

See `docs/shopify-markets-api.md` for the endpoint matrix, deprecation audit,
scope requirements, and recommended next-phase editors.

## Production

Build the application:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

For a Node deployment, ship the Nuxt output and start the Nitro server:

```bash
node .output/server/index.mjs
```

## Docker Compose + Nginx

The production stack runs Nuxt behind Nginx. Nginx is the only public
service; the Nuxt port is available only on the internal Compose network.

The bundled Nginx configuration serves plain HTTP and Compose binds it to
`127.0.0.1` by default. This is a deliberate TLS boundary: do not publish that
listener directly to an untrusted network because browser-held Shopify and
Tracktaco credentials would cross the network without encryption. For a public
deployment, terminate HTTPS at a trusted reverse proxy or load balancer, keep
the Compose listener private, redirect HTTP to HTTPS at that outer proxy, and
set HSTS there after HTTPS is verified. Set `NGINX_BIND_ADDRESS` only when the
selected address is protected by that TLS proxy or a trusted private network.

The app service is tagged as `ghcr.io/sonidia/spfi:latest` by default. Override
it with `APP_IMAGE` when you want to run another image tag.

Make sure the Google service account file exists before starting the stack:

```text
server/service_account.json
```

Build and start the containers:

```bash
docker compose up -d --build
```

To run a published GHCR image without rebuilding locally:

```bash
docker compose pull app
docker compose up -d --no-build
```

Open `http://localhost`. To use another host port:

```bash
NGINX_PORT=8080 docker compose up -d --build
```

On PowerShell:

```powershell
$env:NGINX_PORT = "8080"
docker compose up -d --build
```

Inspect or stop the stack:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## GitHub Actions CI/CD

The Docker workflow lives at `.github/workflows/docker-image.yml`. It builds the
Docker image on pull requests to `main` or `master`, then publishes to GHCR on
pushes to `main`, `master`, version tags like `v1.2.3`, or manual dispatch.

Published image:

```text
ghcr.io/sonidia/spfi
```

Tag rules:

- Pull requests build only and do not publish.
- Pushes to the default branch publish `latest`, the branch tag, and `sha-<short>`.
- Tags like `v1.2.3` publish `1.2.3`, `1.2`, and `sha-<short>`.

The workflow uses GitHub's built-in `GITHUB_TOKEN`, so no custom PAT is required
unless the repository or organization has restricted package publishing. The
token needs `contents: read` and `packages: write`, which are already declared
in the workflow.

## Proxy Formats

Proxy fields accept SOCKS5H remote-DNS shorthand or full proxy URLs:

```text
127.0.0.1:1080
127.0.0.1:1080:user:pass
socks5h://user:pass@127.0.0.1:1080
```

The status checker supports three modes:

- **No proxy**: checks each target directly.
- **Common proxy**: applies one SOCKS5 proxy to every target.
- **Separate proxy**: parses each row as `proxy target`, `proxy|target`, `proxy,target`, or `proxy<TAB>target`.

## Google Sheets

Sheet routes are backed by `server/service_account.json` and default to the `A:Z` range unless a specific range or tab is selected.

Sheet defaults are deployment configuration rather than source-code constants:

```env
NUXT_PUBLIC_SHEET_URLS=https://docs.google.com/spreadsheets/d/example
NUXT_PUBLIC_MASTER_SHEET_URL=https://docs.google.com/spreadsheets/d/master
NUXT_PUBLIC_MASTER_SHEET_TABS=["Shopify T3/2026","Shopify T4/2026"]
```

`NUXT_PUBLIC_SHEET_URLS` preloads sheets in the viewer. The master sheet is used
to populate store credentials when they are not entered manually. If
`NUXT_PUBLIC_MASTER_SHEET_TABS` is empty, the app discovers and searches the
master spreadsheet's tabs. These values are browser-visible; don't put secrets
in the URLs or tab names.

Operators can override these deployment defaults from **Settings → Google
Sheets configuration**. The override is stored only in that browser and is
used by both the Sheet viewer and Manager credential lookup; “Restore
deployment defaults” removes it. Sheet IDs and tab names remain browser-visible
configuration, not a place for secrets.

Expected header aliases for store auto-fill:

- Store ID: `store id`, `store_id`, `storeId`, `id`
- Shop: `shop`, `shop_name`
- Domain: `domain`, `shop_domain`
- Proxy URL: `proxy`, `proxy_url`

## Security Notes

### API response contracts

Collection-style `all` endpoints expose the same self-describing
`success/data/meta` envelope. `meta.strategy` is `cursor`, `complete`, or
`aggregate`; legacy top-level fields remain available for compatibility.

REST-backed routes preserve Shopify `snake_case` fields and GraphQL-backed
routes expose app `camelCase` fields. Shopify responses also send
`X-SPF-Field-Convention`, so consumers do not need to infer the convention.

- Do not commit `server/service_account.json`, `.env` files, logs, or generated build output.
- Store credentials and proxy details should be treated as sensitive operational data.
- Browser API calls are same-origin unless explicitly listed in `NUXT_ALLOWED_ORIGINS`.
- Shopify access tokens for GET and DELETE routes must use the `X-Shopify-Access-Token` header; query-string tokens are rejected.
- CORS is a browser boundary, not user authentication. Keep deployments on localhost, a trusted network, or behind a VPN/reverse proxy when public access is not intended.
- SOCKS proxy hosts are DNS-resolved, rejected if any result is private/reserved, and pinned to a validated public IP before connecting. Isolated VPN deployments that intentionally use a private proxy can opt out with `NUXT_ALLOW_PRIVATE_PROXY_HOSTS=true`.
- `/api/debug-proxy` is disabled by default in production. When explicitly enabled, it accepts only HTTPS destinations on `NUXT_DEBUG_PROXY_ALLOWED_HOSTS`, blocks private/reserved DNS results and redirects, caps response size, and suppresses raw socket errors.
- Store status targets and every redirect are restricted to public HTTPS port 443; direct connections use the validated DNS address to reduce DNS-rebinding risk.
- Production environments must allow outbound HTTPS requests to Shopify, Google APIs, and any proxy endpoints used by status checks.

## Scripts

| Command               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Nuxt development server.                   |
| `npm run build`       | Build the production client and Nitro server.        |
| `npm run preview`     | Run a local preview of the production build.         |
| `npm run generate`    | Generate a static output where supported by the app. |
| `npm run postinstall` | Prepare Nuxt after dependency installation.          |
