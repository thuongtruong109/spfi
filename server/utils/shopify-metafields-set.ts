import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import type { prepareShopifyMetafieldsSetInputs } from "./shopify-metafields-set-input";

export async function setShopifyMetafields(options: {
  event: H3Event;
  storeId: string;
  token: string;
  inputs: ReturnType<typeof prepareShopifyMetafieldsSetInputs>;
}) {
  if (!options.inputs.length) return [];
  const data = await callShopifyGraphql<
    {
      metafieldsSet: {
        metafields: Array<{
          id: string;
          namespace: string;
          key: string;
          value: string;
          type: string;
        }> | null;
        userErrors: Array<{
          field?: string[] | null;
          message: string;
          code?: string;
        }>;
      };
    },
    { metafields: typeof options.inputs }
  >({
    ...options,
    operationName: "SetProductMetafields",
    retryTransport: false,
    query: `#graphql
      mutation SetProductMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id namespace key value type }
          userErrors { field message code }
        }
      }
    `,
    variables: { metafields: options.inputs },
  });
  assertNoGraphqlUserErrors(
    data.metafieldsSet.userErrors,
    "Failed to update product metafields.",
  );
  return data.metafieldsSet.metafields || [];
}
