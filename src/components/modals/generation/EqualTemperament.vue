<script lang="ts">
import { ref } from 'vue'

// Whether the step boxes are showing. Outlives the card body, so closing and reopening the card
// (or switching cards) keeps the choice.
const showSteps = ref(false)
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { OCTAVE } from '@/constants'
import Modal from '@/components/ModalDialog.vue'
import TextSlider, { type Ratio } from '@/components/TextSlider.vue'
import CardReadout from '@/components/rack/CardReadout.vue'
import { MAX_EQUAL_TEMPERAMENT_SIZE, useModalStore } from '@/stores/modal'
import { useScaleStore } from '@/stores/scale'
import { vAutoGrow } from '@/directives/auto-grow'
import { useGeneratorPreview, type GeneratorResult } from '@/composables/useGeneratorPreview'
import { useCardAction } from '@/rack/card-actions'
import { parseInterval } from '@/utils'

defineProps<{
  show: boolean
}>()

/**
 * - `preview`: live update when the card opens and on every change in it. The parent applies it
 *   to the scale without an undo step.
 * - `update:scaleName` + `update:source`: the final result on OK / Raw.
 * - `cancel`: the parent reverts any previewed changes.
 */
const emit = defineEmits<{
  preview: [result: GeneratorResult]
  'update:source': [source: string]
  'update:scaleName': [name: string]
  cancel: []
}>()

const scale = useScaleStore()
const modal = useModalStore()

// Double-click on the divisions slider resets to this.
const DEFAULT_DIVISIONS = 12
const OCTAVE_RATIO: Ratio = [2, 1]
// The interval to divide, in cents. A typed ratio outside this is refused.
const MIN_EQUAVE_CENTS = 1
const MAX_EQUAVE_CENTS = 9600
const MAX_RATIO_TERM = 9999

useCardAction({
  icon: 'steps',
  label: 'Show relative steps and absolute degrees',
  pressed: () => showSteps.value,
  toggle: () => (showSteps.value = !showSteps.value)
})

// The two step boxes share one height, the taller content's, so they stay level.
const stepsHeight = {}

function setDivisions(value: number) {
  modal.divisions = value
  modal.updateFromDivisions()
}

// === Interval to divide: a pitch field (design/cards.md principle 3) ===

/** The ratio the stored equave is spelled as, if it is a ratio the field keeps. */
function ratioOfEquave(): Ratio | null {
  if (modal.equave.domain !== 'linear') {
    return null
  }
  try {
    const fraction = modal.equave.value.toFraction()
    const num = Number(fraction.n)
    const den = Number(fraction.d)
    if (fraction.s > 0 && num <= MAX_RATIO_TERM && den <= MAX_RATIO_TERM) {
      return [num, den]
    }
  } catch {
    // Not a ratio: shown as cents.
  }
  return null
}

const equaveCents = ref(modal.equave.totalCents())
const equaveRatio = ref<Ratio | null>(ratioOfEquave())

function setEquave(cents: number, ratio: Ratio | null) {
  equaveCents.value = cents
  equaveRatio.value = ratio
  // A kept ratio is written as the ratio, cents as a SonicWeave cents literal (with a dot).
  modal.equaveString = ratio ? `${ratio[0]}/${ratio[1]}` : cents.toFixed(3)
  modal.equave = parseInterval(modal.equaveString)
}

// === Readout ===

const stepCents = computed(() => equaveCents.value / modal.divisions)

const degreeCents = computed(() => {
  if (modal.singleStepOnly) {
    return [stepCents.value]
  }
  return modal.degrees
    .filter((steps) => !Number.isNaN(steps))
    .map((steps) => steps * stepCents.value)
})

const stats = computed(() => [
  { label: 'step', value: `${stepCents.value.toFixed(3)} ¢` },
  { label: 'notes', value: String(degreeCents.value.length) },
  { label: 'equave', value: `${equaveCents.value.toFixed(3)} ¢` }
])

// === Output ===

/**
 * SonicWeave source and scale name for the card's current settings.
 * @param expand List every degree instead of the compact `tet(...)` form.
 */
function build(expand: boolean) {
  if (modal.singleStepOnly) {
    const stepCents = modal.equave.value.totalCents() / modal.divisions
    const line = stepCents.toFixed(scale.centsFractionDigits)
    return { source: line, name: `${line} cET` }
  }
  const name = `${modal.divisions} equal divisions of ${modal.equaveString}`
  let source: string
  if (modal.equave.equals(OCTAVE)) {
    const edo = modal.divisions
    if (expand || !modal.simpleEd) {
      source = modal.degrees.map((steps) => `${steps}\\${edo}`).join('\n')
    } else {
      source = `tet(${edo})`
    }
  } else {
    const ed = modal.divisions
    if (expand || !modal.simpleEd) {
      try {
        // Prefer restricted 7\13<3> form
        const ji = modal.equave.toFraction().toFraction()
        source = modal.degrees.map((steps) => `${steps}\\${ed}<${ji}>`).join('\n')
      } catch {
        // Fall back to generic 7\13 ed 1912.3456 form
        source = modal.degrees.map((steps) => `${steps}\\${ed} ed ${modal.equave}`).join('\n')
      }
    } else {
      source = `tet(${ed}, ${modal.equave})`
    }
  }
  return { source, name }
}

/**
 * The live preview, or `undefined` while the settings are mid-edit and don't describe a scale
 * yet (e.g. a half-typed degree list), so the scale isn't flooded with errors while typing.
 */
function buildPreview() {
  if (modal.singleStepOnly) {
    if (!Number.isFinite(modal.equave.value.totalCents() / modal.divisions)) {
      return undefined
    }
  } else if (!modal.degrees.length || modal.degrees.some((steps) => Number.isNaN(steps))) {
    return undefined
  }
  return build(false)
}

useGeneratorPreview(buildPreview, (result) => emit('preview', result))

function generate(expand = true) {
  const { source, name } = build(expand)
  emit('update:scaleName', name)
  emit('update:source', source)
}
</script>

<template>
  <Modal :show="show" embedded @confirm="generate" @cancel="$emit('cancel')">
    <template #header>
      <h2>Generate equal temperament</h2>
    </template>
    <template #body>
      <div class="card-stack">
        <div class="card-grid">
          <div class="card-field">
            <label id="divisions-label">Divisions</label>
            <TextSlider
              aria-labelledby="divisions-label"
              :modelValue="modal.divisions"
              :min="1"
              :max="MAX_EQUAL_TEMPERAMENT_SIZE"
              :defaultValue="DEFAULT_DIVISIONS"
              :dragScale="0.3"
              @update:modelValue="setDivisions"
            />
          </div>
          <div class="card-field">
            <label id="equave-label">Interval to divide</label>
            <TextSlider
              aria-labelledby="equave-label"
              pitch
              :modelValue="equaveCents"
              :ratio="equaveRatio"
              :min="MIN_EQUAVE_CENTS"
              :max="MAX_EQUAVE_CENTS"
              :decimals="3"
              :defaultRatio="OCTAVE_RATIO"
              unit="¢"
              @pitch="setEquave"
            />
          </div>
        </div>
        <div v-if="showSteps" class="card-grid">
          <div class="card-field">
            <label for="jumps" :class="{ disabled: modal.singleStepOnly }">Relative steps</label>
            <textarea
              id="jumps"
              class="card-input"
              v-model="modal.jumpsString"
              v-auto-grow="stepsHeight"
              :disabled="modal.singleStepOnly"
              @input="modal.updateFromJumps"
            ></textarea>
          </div>
          <div class="card-field">
            <label for="degrees" :class="{ disabled: modal.singleStepOnly }">
              Absolute degrees
            </label>
            <textarea
              id="degrees"
              class="card-input"
              v-model="modal.degreesString"
              v-auto-grow="stepsHeight"
              :disabled="modal.singleStepOnly"
              @input="modal.updateFromDegrees"
            ></textarea>
          </div>
        </div>
        <CardReadout :cents="degreeCents" :stats="stats" />
        <p v-if="modal.singleStepOnly" class="warning">
          Fractional divisions make a single step, not a scale.
        </p>
        <p v-else-if="modal.divisions !== modal.safeScaleSize" class="warning">
          The scale is capped at {{ MAX_EQUAL_TEMPERAMENT_SIZE }} notes.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <button @click="() => generate(true)">OK</button>
        <button @click="$emit('cancel')">Cancel</button>
        <button @click="() => generate(false)" :disabled="!modal.simpleEd">Raw</button>
      </div>
    </template>
  </Modal>
</template>
