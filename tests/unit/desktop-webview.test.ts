import { describe, expect, it } from "vitest";
import { parseDesktopWebviewOptions } from "../../app/utils/desktop-webview.ts";

describe("desktop WebView URL options", () => {
  it("parses labeled and unlabeled HTTP URLs", () => {
    expect(
      parseDesktopWebviewOptions(
        "Development|http://localhost:3000,https://example.com/app",
      ),
    ).toEqual([
      { label: "Development", value: "http://localhost:3000" },
      { label: "example.com", value: "https://example.com/app" },
    ]);
  });

  it("drops unsafe, invalid, and duplicate targets", () => {
    expect(
      parseDesktopWebviewOptions(
        "javascript:alert(1),First|https://example.com,Second|https://example.com",
      ),
    ).toEqual([{ label: "First", value: "https://example.com" }]);
  });
});
