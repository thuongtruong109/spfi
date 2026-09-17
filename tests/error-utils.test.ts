import assert from "node:assert/strict";
import test from "node:test";
import { getAppErrorStatusCode } from "../utils/error.ts";

test("reads status codes from Nuxt fetch errors", () => {
  assert.equal(
    getAppErrorStatusCode({
      data: {
        statusCode: 403,
        data: { error: { message: "Forbidden", status: 403 } },
      },
    }),
    403,
  );
});

test("reads status codes from the standard API error envelope", () => {
  assert.equal(
    getAppErrorStatusCode({ data: { error: { message: "Missing", status: 404 } } }),
    404,
  );
});

test("ignores invalid status code values", () => {
  assert.equal(getAppErrorStatusCode({ statusCode: "not-a-status" }), null);
  assert.equal(getAppErrorStatusCode({ statusCode: 42 }), null);
});
