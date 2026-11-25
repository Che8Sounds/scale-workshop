<script setup lang="ts">
import { provide, useId } from 'vue'
import { CARD_ACTION_ICONS, CARD_ACTIONS, createCardActions } from '@/rack/card-actions'

/**
 * One module in the Build Scale rack. The header toggles the card open or closed (the rack keeps
 * one open at a time) and shows what the module currently produces; the body holds its settings.
 * Modifiers also get a drag handle (↑/↓ on it from the keyboard) and a bypass switch.
 */
withDefaults(
  defineProps<{
    title: string
    /** What the module produces right now, e.g. the generator's scale name. */
    summary?: string
    open: boolean
    removeLabel: string
    /** Shows the drag handle and bypass switch (modifiers). */
    modifier?: boolean
    bypassed?: boolean
    /** Whether it has settings to open. */
    expandable?: boolean
    /** Where the chain fails at this stage. */
    error?: string
    /** Its baked code was made from a different input than it now receives. */
    stale?: boolean
  }>(),
  // Vue would read a missing boolean as false.
  { expandable: true }
)

const emit = defineEmits(['toggle', 'remove', 'bypass', 'move', 'dragstart'])

const bodyId = useId()

// Header toggles the card's contents register (`useCardAction`), shown while the card is open.
const actions = createCardActions()
provide(CARD_ACTIONS, actions)

function onHandleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    emit('move', event.key === 'ArrowUp' ? -1 : 1)
  }
}
</script>

<template>
  <article
    class="rack-card"
    :class="{ open, bypassed, 'has-error': !!error, modifier }"
    :aria-label="title"
  >
    <header class="rack-card-header">
      <button
        v-if="modifier"
        class="rack-card-handle"
        draggable="true"
        :aria-label="`Move ${title} (arrow keys)`"
        title="Drag to reorder"
        @dragstart="$emit('dragstart', $event)"
        @keydown="onHandleKeydown"
      >
        ⠿
      </button>
      <button
        class="rack-card-toggle"
        :aria-expanded="!expandable ? undefined : open"
        :aria-controls="!expandable ? undefined : bodyId"
        :disabled="!expandable"
        @click="$emit('toggle')"
      >
        <span v-if="expandable !== false" class="icon-box chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </span>
        <span class="titles">
          <span class="title">{{ title }}</span>
          <span v-if="summary" class="summary">{{ summary }}</span>
        </span>
      </button>
      <button
        v-if="modifier"
        class="rack-card-bypass"
        :aria-pressed="!bypassed"
        :aria-label="bypassed ? `Turn ${title} on` : `Bypass ${title}`"
        :title="bypassed ? 'Bypassed: click to turn on' : 'On: click to bypass'"
        @click="$emit('bypass')"
      >
        <span class="led" aria-hidden="true"></span>
      </button>
      <button
        v-for="action of open ? actions : []"
        :key="action.icon"
        class="rack-card-action"
        :aria-pressed="action.pressed()"
        :aria-label="action.label"
        :title="action.label"
        @click="action.toggle()"
      >
        <span class="icon-box" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path :d="CARD_ACTION_ICONS[action.icon]" /></svg>
        </span>
      </button>
      <button class="rack-card-remove" :aria-label="removeLabel" @click="$emit('remove')">
        <span class="icon-box" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </span>
      </button>
    </header>
    <p v-if="error" class="rack-card-status error" role="status">{{ error }}</p>
    <p v-else-if="stale && !open" class="rack-card-status" role="status">
      The scale above changed since this was made. Open the card to update it.
    </p>
    <div v-if="open" :id="bodyId" class="rack-card-body">
      <slot></slot>
    </div>
  </article>
</template>

<style scoped>
/*
 * Card layout tokens (design/cards.md). One inset on all four sides of the body (principle 1);
 * the header's icons sit on the same inset lines, their 32px hit areas overhanging into it.
 */
.rack-card {
  --card-inset: 16px;
  --card-gap: 12px;
  --control-h: 2.25rem;
  --icon-size: 20px;
  --icon-box: 32px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
}
.rack-card.has-error {
  border-color: var(--color-error, #d33);
}
.rack-card.bypassed .titles {
  opacity: 0.45;
}
.rack-card-header {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px calc(var(--card-inset) - (var(--icon-box) - var(--icon-size)) / 2);
}
.rack-card.open .rack-card-header {
  border-bottom: 1px solid var(--color-border);
}
.rack-card-header button {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.icon-box {
  flex: none;
  width: var(--icon-box);
  height: var(--icon-box);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
.icon-box svg {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.rack-card-handle {
  width: var(--icon-box);
  align-self: stretch;
  cursor: grab;
  opacity: 0.6;
  touch-action: none;
}
.rack-card-handle:active {
  cursor: grabbing;
}
.rack-card-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
}
.rack-card-toggle:disabled {
  cursor: default;
}
.chevron {
  transition: transform 0.15s ease;
  transform: rotate(-90deg);
}
.open .chevron {
  transform: none;
}
.rack-card-toggle:hover .chevron,
.rack-card-action:hover .icon-box,
.rack-card-remove:hover .icon-box {
  background-color: color-mix(in srgb, currentColor 10%, transparent);
}
.titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.title {
  font-weight: bold;
}
.summary {
  font-size: 0.85em;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rack-card-bypass {
  width: var(--icon-box);
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}
.led {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background-color: var(--color-accent, #6cf);
  box-shadow: 0 0 0.3rem var(--color-accent, #6cf);
}
.bypassed .led {
  background-color: transparent;
  box-shadow: none;
  border: 1px solid currentColor;
  opacity: 0.6;
}
.rack-card-action,
.rack-card-remove {
  opacity: 0.6;
}
.rack-card-action[aria-pressed='true'] {
  opacity: 1;
  color: var(--color-accent-text-btn);
}
.rack-card-action:hover,
.rack-card-action:focus-visible,
.rack-card-remove:hover,
.rack-card-remove:focus-visible,
.rack-card-handle:hover,
.rack-card-handle:focus-visible {
  opacity: 1;
}
.rack-card-status {
  margin: 0;
  padding: 0.4rem var(--card-inset);
  font-size: 0.85em;
  opacity: 0.8;
}
.rack-card-status.error {
  color: var(--color-error, #d33);
  opacity: 1;
}
.rack-card-body {
  padding: var(--card-inset);
}
/* Nothing but the inset at the body's edges, whatever margins the contents bring (principle 1). */
.rack-card-body :deep(.modal-embedded > :first-child) {
  margin-top: 0;
}
.rack-card-body :deep(.modal-embedded > :last-child) {
  margin-bottom: 0;
}
</style>
