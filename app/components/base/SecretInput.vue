<script setup lang="ts">
import { Eye, EyeOff } from "@lucide/vue";
import { ref } from "vue";

withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    showLabel?: string;
    hideLabel?: string;
    autocomplete?: string;
  }>(),
  {
    placeholder: "",
    showLabel: "Show secret",
    hideLabel: "Hide secret",
    autocomplete: "new-password",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
const isRevealed = ref(false);

function updateValue(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="secret-input">
    <input
      class="secret-input__control"
      :value="modelValue"
      :type="isRevealed ? 'text' : 'password'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      @input="updateValue"
    />
    <button
      class="secret-input__toggle"
      type="button"
      :aria-label="isRevealed ? hideLabel : showLabel"
      :title="isRevealed ? hideLabel : showLabel"
      :aria-pressed="isRevealed"
      @click="isRevealed = !isRevealed"
    >
      <EyeOff v-if="isRevealed" aria-hidden="true" />
      <Eye v-else aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.secret-input {
  position: relative;
  width: 100%;
}

.secret-input__control {
  width: 100%;
  min-height: var(--control-height-md);
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface);
  color: var(--text);
  padding: 9px 42px 9px 11px;
  font: inherit;
}

.secret-input__control:focus-visible {
  border-color: var(--green);
  outline: none;
  box-shadow: var(--focus-ring);
}

.secret-input__toggle {
  position: absolute;
  top: 50%;
  right: 7px;
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  transform: translateY(-50%);
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
}

.secret-input__toggle:hover {
  background: var(--surface-soft);
  color: var(--text);
}

.secret-input__toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.secret-input__toggle svg {
  width: 17px;
  height: 17px;
}
</style>
