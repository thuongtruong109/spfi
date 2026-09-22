import { defineNuxtPlugin } from "#imports";
import type { Pinia } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";

export default defineNuxtPlugin({
  name: "credential-vault",
  dependsOn: ["pinia"],
  async setup(nuxtApp) {
    const pinia = nuxtApp.$pinia as Pinia | undefined;
    if (!pinia) {
      throw new Error("Pinia is unavailable while initializing the credential vault.");
    }
    await useCredentialVaultStore(pinia).initialize();
  },
});
