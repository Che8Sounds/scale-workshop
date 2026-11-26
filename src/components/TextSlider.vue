<script setup lang="ts">
/**
 * Text-based drag slider, ported from Omnitonal Performer's `OCTextSlider`.
 *
 * - Drag up/down changes the value by `step * dragScale` per pixel (Shift = 0.1x fine).
 * - Double-click resets to `defaultValue` when one is given.
 * - Click focuses. Arrow up/down nudge by `step` (Shift = x10).
 * - Typing a digit, '-' or '.' starts an in-place edit: Enter commits, Escape cancels
 *   (or blurs when not editing), Backspace deletes, and losing focus commits.
 *
 * Interactive changes are clamped to [min, max]. Drags snap to the `step` grid, while a typed
 * value is kept as typed (only clamped), so e.g. fractional divisions stay possible.
 *
 * With `pitch` it is a pitch field (Performer's `keepsRatio`, design/cards.md principle 3): the
 * value is in cents and the field also takes a typed ratio.
 * - Typing follows the site's Scala convention, read by SonicWeave: a number with a point is
 *   cents (`702.`, `701.955`), one without is a ratio (`3` is 3/1, `3/2`), and the rest of
 *   SonicWeave works too (`7\12`, `3c`). A ratio with whole terms up to 9999 is kept, reduced, and
 *   shown as a ratio; anything else applies and shows as cents. A typed ratio outside [min, max]
 *   is refused rather than clamped; typed cents are clamped.
 * - Cents always show with a point (`1200.000`, or `1200.` with no decimals), so what the field
 *   shows can be typed back. Pitch fields take no unit.
 * - Hovering a field that shows a ratio shows its cents instead, at 85% of the ink.
 * - Anything that moves the value (drag, nudge, reset to a cents default) drops the ratio.
 * - Double-click resets to `defaultRatio` when one is given.
 * - Modifiers: Shift 0.1x, Cmd (Ctrl off the Mac) 10x, Cmd wins. The drag moves `dragScale`
 *   cents per pixel and an arrow press moves 1 cent, both times the modifier.
 * Every interactive change also emits `pitch` with the cents and the kept ratio (or null).
 *
 * Not ported: Performer's label caption (use a regular <label> with `aria-labelledby`) and its
 * carved/card paints.
 */
import { computed, ref } from 'vue'
import { centString, parseInterval, smallRatio } from '@/utils'

export type Ratio = [number, number]

const props = withDefaults(
  defineProps<{
    modelValue: number
    min: number
    max: number
    step?: number
    decimals?: number
    dragScale?: number
    defaultValue?: number
    unit?: string
    disabled?: boolean
    /** A pitch field: the value is cents and a ratio can be typed and kept. */
    pitch?: boolean
    /** The ratio a pitch field's value was typed as, if it is kept. */
    ratio?: Ratio | null
    /** What a pitch field's double-click resets to, when its default is a ratio. */
    defaultRatio?: Ratio
  }>(),
  {
    step: 1,
    decimals: 0,
    dragScale: 1,
    defaultValue: undefined,
    unit: '',
    disabled: false,
    pitch: false,
    ratio: null,
    defaultRatio: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'update:ratio': [ratio: Ratio | null]
  pitch: [cents: number, ratio: Ratio | null]
}>()

// Pointer travel (px) before a press becomes a drag: DragGesture(minimumDistance: 2).
const DRAG_THRESHOLD = 2
const FINE_MULTIPLIER = 0.1
const COARSE_KEY_MULTIPLIER = 10
// Pitch fields: Cmd is this much faster, and one arrow press moves this many cents.
const PITCH_FAST_MULTIPLIER = 10
const PITCH_KEY_STEP = 1
// A kept ratio's largest term.
const MAX_RATIO_TERM = 9999
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/

const root = ref<HTMLDivElement | null>(null)
const isEditing = ref(false)
const editText = ref('')
const isDragging = ref(false)
const isHovered = ref(false)

let pointerId: number | null = null
let downX = 0
let downY = 0
let lastDy = 0
// Unrounded running value so sub-step pixel movement accumulates across frames.
let accumulator = 0

const showsRatio = computed(() => props.pitch && !!props.ratio)

/** While the pointer is over a field showing a ratio, it shows the ratio's cents instead. */
const swapsToCents = computed(
  () =>
    showsRatio.value && isHovered.value && !isEditing.value && !isDragging.value && !props.disabled
)

const numberText = computed(() =>
  props.pitch
    ? centString(props.modelValue, props.decimals)
    : props.decimals > 0
      ? props.modelValue.toFixed(props.decimals)
      : String(props.modelValue)
)

const displayText = computed(() =>
  showsRatio.value && !swapsToCents.value
    ? `${props.ratio![0]}/${props.ratio![1]}`
    : numberText.value
)

const showsUnit = computed(() => !!props.unit && (!showsRatio.value || swapsToCents.value))

function clamp(value: number) {
  return Math.min(props.max, Math.max(props.min, value))
}

function decimalsOf(value: number) {
  const text = String(value)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

function snapToStep(value: number) {
  const snapped = Math.round(value / props.step) * props.step
  // Strip floating point noise such as 0.30000000000000004.
  const digits = Math.max(props.decimals, decimalsOf(props.step))
  return clamp(Number(snapped.toFixed(digits)))
}

function sameRatio(a: Ratio | null | undefined, b: Ratio | null | undefined) {
  return (a ?? null) === (b ?? null) || (!!a && !!b && a[0] === b[0] && a[1] === b[1])
}

/** Clamps and emits. A pitch field keeps `ratio` (null unless a ratio was just typed). */
function setValueInteractive(value: number, ratio: Ratio | null = null) {
  if (Number.isNaN(value)) {
    return
  }
  const clamped = clamp(value)
  const keptRatio = props.pitch ? ratio : null
  if (clamped === props.modelValue && sameRatio(keptRatio, props.pitch ? props.ratio : null)) {
    return
  }
  if (clamped !== props.modelValue) {
    emit('update:modelValue', clamped)
  }
  if (props.pitch) {
    if (!sameRatio(keptRatio, props.ratio)) {
      emit('update:ratio', keptRatio)
    }
    emit('pitch', clamped, keptRatio)
  }
}

/** The modifier multiplier: Shift finer, and on a pitch field Cmd/Ctrl faster (Cmd wins). */
function multiplier(event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
  if (props.pitch && (event.metaKey || event.ctrlKey)) {
    return PITCH_FAST_MULTIPLIER
  }
  return event.shiftKey ? FINE_MULTIPLIER : 1
}

/**
 * A pitch field's typed text as cents and the ratio to keep (null if it isn't one), or undefined
 * if SonicWeave can't read it as a pitch. `ratioSpelled`: typed as a ratio or bare number.
 */
function parsePitch(
  text: string
): { cents: number; kept: Ratio | null; ratioSpelled: boolean } | undefined {
  try {
    const interval = parseInterval(text)
    const cents = interval.totalCents()
    if (!Number.isFinite(cents)) {
      return undefined
    }
    return {
      cents,
      kept: smallRatio(interval, MAX_RATIO_TERM),
      ratioSpelled: interval.domain === 'linear'
    }
  } catch {
    return undefined
  }
}

// --- Pointer ---

function onPointerdown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) {
    return
  }
  // No preventDefault here: that would suppress the follow-up mousedown the app relies on to
  // know a text field has focus (so typing doesn't play notes). Selection is blocked in
  // onMousedown instead, and focus is set explicitly below.
  if (isEditing.value) {
    commitEdit()
  }
  root.value?.focus()
  pointerId = event.pointerId
  downX = event.clientX
  downY = event.clientY
  lastDy = 0
  isDragging.value = false
  root.value?.setPointerCapture?.(event.pointerId)
}

function onMousedown(event: MouseEvent) {
  // Stops text selection (including double-click word selection) from starting in the box.
  // The event still bubbles to the app's listeners.
  event.preventDefault()
  window.getSelection()?.removeAllRanges()
}

function onPointermove(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return
  }
  const dy = event.clientY - downY
  if (!isDragging.value) {
    if (Math.hypot(event.clientX - downX, dy) < DRAG_THRESHOLD) {
      return
    }
    isDragging.value = true
    accumulator = props.modelValue
    lastDy = 0
  }
  // A pitch field moves `dragScale` cents per pixel; others `step * dragScale`.
  const perPixel = (props.pitch ? 1 : props.step) * props.dragScale * multiplier(event)
  accumulator = clamp(accumulator - (dy - lastDy) * perPixel)
  lastDy = dy
  const next = props.pitch
    ? clamp(Number(accumulator.toFixed(props.decimals)))
    : snapToStep(accumulator)
  setValueInteractive(next)
}

function onPointerup(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return
  }
  if (root.value?.hasPointerCapture?.(event.pointerId)) {
    root.value.releasePointerCapture(event.pointerId)
  }
  pointerId = null
  isDragging.value = false
}

function onDoubleClick() {
  if (props.disabled) {
    return
  }
  if (props.pitch && props.defaultRatio) {
    const [num, den] = props.defaultRatio
    setValueInteractive(1200 * Math.log2(num / den), [num, den])
  } else if (props.defaultValue !== undefined) {
    setValueInteractive(props.defaultValue)
  }
}

// --- Keyboard ---

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }
  // Select all would highlight the whole page from here; there is no text to select.
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  const isArrow = event.key === 'ArrowUp' || event.key === 'ArrowDown'
  // A pitch field's arrows take Cmd/Ctrl as "faster"; other shortcuts pass through.
  if (
    (event.ctrlKey || event.metaKey || event.altKey) &&
    !(props.pitch && isArrow && !event.altKey)
  ) {
    return
  }
  let handled = true
  if (isArrow) {
    if (!isEditing.value) {
      const delta = props.pitch
        ? PITCH_KEY_STEP * multiplier(event)
        : event.shiftKey
          ? props.step * COARSE_KEY_MULTIPLIER
          : props.step
      setValueInteractive(props.modelValue + (event.key === 'ArrowUp' ? delta : -delta))
    }
  } else if (event.key === 'Enter') {
    if (isEditing.value) {
      commitEdit()
    }
  } else if (event.key === 'Escape') {
    if (isEditing.value) {
      cancelEdit()
    } else {
      root.value?.blur()
    }
  } else if (event.key === 'Backspace') {
    if (isEditing.value) {
      editText.value = editText.value.slice(0, -1)
    }
  } else if (
    /^[0-9.-]$/.test(event.key) ||
    // Once typing, a pitch field takes any SonicWeave character (`/`, `\`, `,`, `c`, ...).
    (props.pitch && isEditing.value && event.key.length === 1)
  ) {
    if (isEditing.value) {
      editText.value += event.key
    } else {
      editText.value = event.key
      isEditing.value = true
    }
  } else {
    // Tab and everything else keep their default behavior.
    handled = false
  }
  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function commitEdit() {
  if (!isEditing.value) {
    return
  }
  const typed = editText.value.trim()
  // A failed parse keeps the old value.
  if (props.pitch) {
    const pitch = parsePitch(typed)
    // A ratio outside the range is refused, not clamped: the ratio typed is not the one a clamp
    // keeps. Typed cents are clamped like a drag.
    const inRange = !!pitch && pitch.cents >= props.min && pitch.cents <= props.max
    if (pitch && (inRange || !pitch.ratioSpelled)) {
      setValueInteractive(pitch.cents, pitch.kept)
    }
  } else if (NUMBER_PATTERN.test(typed)) {
    setValueInteractive(parseFloat(typed))
  }
  cancelEdit()
}

function cancelEdit() {
  isEditing.value = false
  editText.value = ''
}

defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <div
    ref="root"
    class="text-slider"
    :class="{ editing: isEditing, dragging: isDragging, disabled }"
    role="spinbutton"
    :tabindex="disabled ? -1 : 0"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :aria-valuetext="showsUnit ? `${displayText} ${unit}` : displayText"
    :aria-disabled="disabled || undefined"
    :data-editing="isEditing || undefined"
    :title="
      pitch
        ? 'Drag up or down, double-click to reset, or type cents or a ratio'
        : 'Drag up or down, double-click to reset, or type a number'
    "
    @pointerdown="onPointerdown"
    @mousedown="onMousedown"
    @pointermove="onPointermove"
    @pointerup="onPointerup"
    @pointercancel="onPointerup"
    @pointerenter="isHovered = true"
    @pointerleave="isHovered = false"
    @dblclick="onDoubleClick"
    @keydown="onKeydown"
    @blur="commitEdit"
  >
    <template v-if="isEditing">
      <span class="value">{{ editText }}</span
      ><span class="caret" aria-hidden="true"></span>
    </template>
    <template v-else>
      <span class="value" :class="{ swapped: swapsToCents }">{{ displayText }}</span>
      <span v-if="showsUnit" class="unit">{{ unit }}</span>
    </template>
  </div>
</template>

<style scoped>
.text-slider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex-grow: 1;
  min-width: 2.6rem;
  height: 2.25rem;
  padding: 0 0.5rem;
  border-radius: 6px;
  /* Performer: systemGray at 15% fill. Accent edge at 48% unfocused, 96% focused (cards.md 4). */
  background-color: rgba(142, 142, 147, 0.15);
  border: 1px solid color-mix(in srgb, var(--color-accent-text-btn) 48%, transparent);
  color: var(--color-accent-text-btn);
  cursor: ns-resize;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
  outline: none;
}
.text-slider:focus-visible,
.text-slider:focus,
.text-slider.dragging {
  border-color: color-mix(in srgb, var(--color-accent-text-btn) 96%, transparent);
}
/* Never paint a selection highlight, even when a selection started elsewhere covers the box. */
.text-slider::selection,
.text-slider *::selection {
  background: transparent;
}
.text-slider.editing {
  cursor: text;
}
.text-slider.disabled {
  opacity: 0.4;
  cursor: default;
}
.value {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
/* A kept ratio's cents while hovered: 85% of the ink. */
.value.swapped {
  color: color-mix(in srgb, var(--color-accent-text-btn) 85%, transparent);
}
.unit {
  font-size: 0.7rem;
  opacity: 0.6;
}
.caret {
  width: 2px;
  height: 1.3rem;
  margin-left: 1px;
  background-color: currentColor;
  animation: caret-blink 1s steps(1) infinite;
}
@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}
</style>
