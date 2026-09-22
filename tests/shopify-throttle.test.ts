import assert from "node:assert/strict";
import test from "node:test";
import {
  capShopifyThrottleDelayMs,
  getGraphqlCostSummary,
  getGraphqlThrottleDecision,
  getGraphqlThrottleDelayMs,
  getRestCallLimitDelayMs,
  getShopifyqlBudgetDelayMs,
  getShopifyqlCostSummary,
  isGraphqlThrottled,
  parseShopifyRestCallLimit,
  parseRetryAfterMs,
} from "../server/utils/shopify-throttle.ts";

test("Retry-After supports fractional seconds and HTTP dates without a cap", () => {
  assert.equal(parseRetryAfterMs("2.5"), 2_500);
  assert.equal(parseRetryAfterMs("15"), 15_000);
  assert.equal(
    parseRetryAfterMs("Fri, 07 Aug 2026 12:00:05 GMT", Date.UTC(2026, 7, 7, 12)),
    5_000,
  );
  assert.equal(parseRetryAfterMs("invalid"), null);
});

test("request retry waits are capped even when Retry-After is excessive", () => {
  assert.equal(capShopifyThrottleDelayMs(500), 500);
  assert.equal(capShopifyThrottleDelayMs(120_000), 30_000);
});

test("REST call-limit headers trigger proactive bucket backoff", () => {
  assert.deepEqual(parseShopifyRestCallLimit("32/40"), {
    used: 32,
    total: 40,
    remaining: 8,
  });
  assert.equal(getRestCallLimitDelayMs("31/40"), null);
  assert.equal(getRestCallLimitDelayMs("32/40"), 1_000);
  assert.equal(getRestCallLimitDelayMs("39/40"), 4_500);
  assert.equal(getRestCallLimitDelayMs("invalid"), null);
});

test("GraphQL retry delay is calculated from the returned throttle state", () => {
  assert.equal(
    getGraphqlThrottleDelayMs({
      cost: {
        requestedQueryCost: 101,
        throttleStatus: {
          currentlyAvailable: 50,
          restoreRate: 100,
          maximumAvailable: 2_000,
        },
      },
    }),
    510,
  );
});

test("ShopifyQL throttling waits for its independent window to reset", () => {
  const now = Date.parse("2026-07-16T07:05:40.000Z");
  assert.deepEqual(
    getGraphqlThrottleDecision({
      now,
      shopifyqlOperation: true,
      extensions: {
        cost: {
          requestedQueryCost: 3,
          throttleStatus: {
            currentlyAvailable: 999,
            restoreRate: 50,
          },
        },
        shopifyqlCost: {
          requestedQueryCost: 40,
          maximumAvailable: 1000,
          currentlyAvailable: 0,
          windowResetAt: "2026-07-16T07:06:00+00:00",
        },
      },
    }),
    { delayMs: 20_250, scope: "shopifyql" },
  );
});

test("ShopifyQL throttling reads reset metadata returned on the field error", () => {
  const now = Date.parse("2026-07-16T07:05:50.000Z");
  assert.deepEqual(
    getGraphqlThrottleDecision({
      now,
      shopifyqlOperation: true,
      errors: [
        {
          extensions: {
            code: "THROTTLED",
            cost: {
              requestedQueryCost: 200,
              maximumAvailable: 1000,
              currentlyAvailable: 0,
              windowResetAt: "2026-07-16T07:06:00+00:00",
            },
          },
        },
      ],
    }),
    { delayMs: 10_250, scope: "shopifyql" },
  );
});

test("ShopifyQL uses a full-window fallback when reset metadata is unavailable", () => {
  assert.deepEqual(
    getGraphqlThrottleDecision({
      shopifyqlOperation: true,
      extensions: {
        cost: {
          requestedQueryCost: 3,
          throttleStatus: { currentlyAvailable: 999, restoreRate: 50 },
        },
      },
    }),
    { delayMs: 60_000, scope: "shopifyql" },
  );
});

test("ShopifyQL proactively pauses the next query when the remaining budget is low", () => {
  const now = Date.parse("2026-07-16T07:05:55.000Z");
  assert.equal(
    getShopifyqlBudgetDelayMs(
      {
        shopifyqlCost: {
          requestedQueryCost: 80,
          currentlyAvailable: 50,
          windowResetAt: "2026-07-16T07:06:00+00:00",
        },
      },
      now,
    ),
    5_250,
  );
  assert.equal(
    getShopifyqlBudgetDelayMs(
      {
        shopifyqlCost: {
          requestedQueryCost: 50,
          currentlyAvailable: 50,
          windowResetAt: "2026-07-16T07:06:00+00:00",
        },
      },
      now,
    ),
    null,
  );
});

test("GraphQL throttling is detected from Shopify's error code", () => {
  assert.equal(isGraphqlThrottled([{ extensions: { code: "THROTTLED" } }]), true);
  assert.equal(isGraphqlThrottled([{ extensions: { code: "ACCESS_DENIED" } }]), false);
});

test("GraphQL cost metadata exposes requested and actual query cost", () => {
  assert.deepEqual(
    getGraphqlCostSummary({
      cost: { requestedQueryCost: "240", actualQueryCost: 37 },
    }),
    { requestedQueryCost: 240, actualQueryCost: 37 },
  );
  assert.equal(getGraphqlCostSummary(), null);
});

test("ShopifyQL cost metadata exposes its independent query budget", () => {
  assert.deepEqual(
    getShopifyqlCostSummary({
      shopifyqlCost: {
        requestedQueryCost: "7",
        maximumAvailable: 1000,
        currentlyAvailable: 993,
        windowResetAt: "2026-07-16T07:06:00+00:00",
      },
    }),
    {
      requestedQueryCost: 7,
      maximumAvailable: 1000,
      currentlyAvailable: 993,
      windowResetAt: "2026-07-16T07:06:00+00:00",
    },
  );
  assert.equal(getShopifyqlCostSummary(), null);
});
