export function useRuntimeConfig() {
  return {};
}

export function defineNuxtPlugin<T extends (...args: never[]) => unknown>(
  plugin:
    | T
    | {
        name?: string;
        dependsOn?: string[];
        setup: T;
      },
) {
  if (typeof plugin === "function") return plugin;
  const { name, ...metadata } = plugin;
  return Object.assign(plugin.setup, metadata, { _name: name });
}
