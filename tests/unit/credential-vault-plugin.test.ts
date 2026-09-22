import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import credentialVaultPlugin from "~/plugins/credential-vault.client";
import { useCredentialVaultStore } from "~/stores/credentialVault";

type CredentialVaultPlugin = ((nuxtApp: { $pinia?: Pinia }) => Promise<void>) & {
  _name?: string;
  dependsOn?: string[];
};

describe("credential vault Nuxt plugin", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(undefined);
  });

  it("waits for Pinia and initializes with the injected instance", async () => {
    const plugin = credentialVaultPlugin as CredentialVaultPlugin;
    const pinia = createPinia();

    expect(plugin._name).toBe("credential-vault");
    expect(plugin.dependsOn).toEqual(["pinia"]);
    await expect(plugin({ $pinia: pinia })).resolves.toBeUndefined();
    expect(useCredentialVaultStore(pinia).isInitialized).toBe(true);
  });

  it("reports a clear error when Pinia injection is unavailable", async () => {
    const plugin = credentialVaultPlugin as CredentialVaultPlugin;

    await expect(plugin({})).rejects.toThrow(
      "Pinia is unavailable while initializing the credential vault.",
    );
  });
});
