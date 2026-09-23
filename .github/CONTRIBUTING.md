# Contributing to SPF

Thanks for helping improve SPF, the Shopify operations console.

## Prerequisites

- Node.js 24.x
- npm 10 or newer
- Access to a Shopify development store for authenticated workflows
- A Google service account only when working on Google Sheets features

The Node version must satisfy the range in `package.json` and match the version
used by CI and Docker.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local configuration from the example:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

3. For Google Sheets features, place the service account JSON at
   `server/service_account.json` and share the target spreadsheet with its
   `client_email`.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Then open `http://localhost:3000`.

Keep credentials, tokens, `.env`, and `server/service_account.json` local. Do
not commit secrets, generated output, dependency directories, or build
artifacts.

## Checks

Run all checks before opening a pull request:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

`npm test` runs both the Node test suite and the Vitest suite. Use
`npm run format` to apply Prettier fixes locally.

## Making changes

- Keep changes focused and follow the existing Nuxt, Vue, TypeScript, and
  server-route patterns.
- Add or update tests for behavior changes, especially API contracts,
  authentication, webhook handling, and data normalization.
- Update relevant documentation when configuration, workflows, or public API
  behavior changes.
- Do not weaken security checks or expose Shopify credentials in browser code.

## Pull requests

1. Create a focused branch from `main`.
2. Use a clear commit message describing the change.
3. Include a concise summary, testing performed, and any configuration or
   migration notes in the pull request.
4. Confirm that all checks pass and that no secrets or generated files are
   included.
