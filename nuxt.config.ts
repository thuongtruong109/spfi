import {
  DEFAULT_ANALYTICS_RATE_LIMIT_PER_MINUTE,
  DEFAULT_API_RATE_LIMIT_PER_MINUTE,
  DEFAULT_EXPORT_RATE_LIMIT_PER_MINUTE,
  DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
} from "./server/utils/rate-limit-policy";
import { readFileSync } from "node:fs";

const desktopWebviewTargets = JSON.parse(
  readFileSync(
    new URL("./wrapper/src-tauri/webview-targets.json", import.meta.url),
    "utf8",
  ),
) as Array<{ label: string; url: string }>;
const desktopWebviewUrls = desktopWebviewTargets
  .map(({ label, url }) => `${label}|${url}`)
  .join(",");

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@pinia/nuxt", "@nuxt/eslint"],
  typescript: {
    tsConfig: {
      compilerOptions: {
        // Node's native TypeScript test runner needs explicit source extensions.
        allowImportingTsExtensions: true,
      },
    },
  },
  app: {
    head: {
      script: [
        {
          src: "/theme-bootstrap.js",
        },
      ],
    },
  },
  runtimeConfig: {
    adminApiVersion: "2026-07",
    allowedOrigins: "",
    apiOriginRequired: true,
    allowHostOriginFallback: process.env.NODE_ENV !== "production",
    trustProxyHeaders: false,
    allowPrivateProxyHosts: false,
    debugProxyEnabled: process.env.NODE_ENV !== "production",
    debugProxyAllowedHosts: "httpbin.org,api.ipify.org",
    webhookPublicUrl: "",
    webhookEncryptionKey: "",
    public: {
      sheetUrls: "",
      masterSheetUrl: "",
      masterSheetTabs: "",
      desktopWebviewUrls,
    },
    // Fail closed when no deployment-specific limits are configured.
    apiRateLimitPerMinute: DEFAULT_API_RATE_LIMIT_PER_MINUTE,
    analyticsRateLimitPerMinute: DEFAULT_ANALYTICS_RATE_LIMIT_PER_MINUTE,
    exportRateLimitPerMinute: DEFAULT_EXPORT_RATE_LIMIT_PER_MINUTE,
    tokenRateLimitPerMinute: DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
  },
  nitro: {
    storage: {
      webhooks: {
        driver: "fs",
        base: process.env.NITRO_WEBHOOK_STORAGE_PATH || "./.data/webhooks",
      },
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          allowImportingTsExtensions: true,
        },
      },
    },
    externals: {
      external: ["papaparse"],
      traceInclude: ["./node_modules/papaparse/papaparse.js"],
    },
    rollupConfig: {
      external: [/papaparse/],
    },
  },
  vite: {
    plugins: [
      {
        name: "fix-papaparse",
        transform(code: string, id: string | string[]) {
          if (id.includes("papaparse")) {
            return code
              .replace(/typeof window/g, "typeof(window)")
              .replace(/typeof self/g, "typeof(self)");
          }
        },
      },
    ],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit", "@lucide/vue", "papaparse"],
    },
  },
  // Auto-import utils
  imports: {
    dirs: ["utils/**"],
  },
});
