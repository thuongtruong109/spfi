# Shopify commerce operations workspace

The store page's **Operations** tab is a single workspace for draft conversion,
discount administration, checkout recovery, and return requests. Each resource
loads independently; a missing Shopify scope only disables the affected panel.

## Internal endpoints

| Resource            | List endpoint                                | Mutation endpoints                           | Shopify API                                              |
| ------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Draft orders        | `POST /api/commerce-ops/draft-orders`        | `draft-orders/create`, `draft-orders/action` | GraphQL draft-order queries and mutations                |
| Discounts           | `POST /api/commerce-ops/discounts`           | `discounts/create`, `discounts/action`       | GraphQL discount nodes and basic code-discount mutations |
| Abandoned checkouts | `POST /api/commerce-ops/abandoned-checkouts` | Read-only recovery link                      | GraphQL `abandonedCheckouts`                             |
| Returns             | `POST /api/commerce-ops/returns`             | `returns/action`                             | GraphQL return lifecycle mutations                       |

All requests include the selected `storeId` and access token. IDs that reach a
mutation are validated as the expected Shopify GID type.

## Supported workflows

- Draft orders: create a custom line-item draft, send its invoice, complete it
  as paid, or delete it.
- Discounts: list native and app-managed discounts, create a basic discount
  code, and activate or deactivate code discounts.
- Abandoned checkouts: inspect recent checkouts and open the Shopify-hosted
  recovery URL. Recovery links are never reconstructed locally.
- Returns: review recent return requests, approve or decline requests, and
  cancel or close active returns. Closing is a lifecycle action, not a refund or
  inventory adjustment.

Return discovery uses two bounded queries: it finds return-bearing orders among
the 50 most recently updated orders, then loads at most ten orders with five
returns and ten line items each. This keeps GraphQL query cost predictable.

## Access scopes

The relevant scopes are `read_draft_orders`, `write_draft_orders`,
`read_discounts`, `write_discounts`, `read_orders`, `read_returns`, and
`write_returns`. Reading abandoned checkouts also requires the staff user to
have Shopify's `manage_abandoned_checkouts` permission. The Operations UI shows
resource-specific errors so operators can distinguish missing access from a
failure in another panel.

References:

- https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderComplete
- https://shopify.dev/docs/api/admin-graphql/latest/queries/discountNodes
- https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts
- https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps
