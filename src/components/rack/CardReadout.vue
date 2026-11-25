<script setup lang="ts">
import { computed } from 'vue'

/**
 * A card's readout strip (design/cards.md): a mini pitch ruler of the scale it makes, then a row
 * of derived values. It shows results, not settings, so it takes no input.
 */
const props = defineProps<{
  /** Every degree in cents, ascending, the last one the equave. The unison is implied. */
  cents: number[]
  stats: { label: string; value: string }[]
}>()

// Past this many ticks the ruler is a smear anyway; drawing every one only costs time.
const MAX_TICKS = 300
const WIDTH = 1000
const PAD = 4

const ticks = computed(() => {
  const equave = props.cents[props.cents.length - 1]
  if (!(equave > 0)) {
    return []
  }
  const every = Math.ceil(props.cents.length / MAX_TICKS)
  const result = [{ x: PAD, end: true }]
  props.cents.forEach((cents, index) => {
    const end = index === props.cents.length - 1
    if (end || index % every === every - 1) {
      result.push({ x: PAD + (cents / equave) * (WIDTH - 2 * PAD), end })
    }
  })
  return result
})

const thin = computed(() => ticks.value.length > 100)
</script>

<template>
  <div class="card-readout">
    <svg
      class="ruler"
      :viewBox="`0 0 ${WIDTH} 22`"
      preserveAspectRatio="none"
      role="img"
      aria-label="Scale degrees within the equave"
    >
      <line :x1="PAD" :x2="WIDTH - PAD" y1="20" y2="20" class="base" />
      <line
        v-for="(tick, index) of ticks"
        :key="index"
        :x1="tick.x"
        :x2="tick.x"
        :y1="tick.end ? 2 : 8"
        y2="20"
        :class="{ tick: true, end: tick.end, thin }"
      />
    </svg>
    <dl class="stats">
      <div v-for="stat of stats" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.card-readout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* On top of the card gap: the readout shows results, so it sits apart from the controls. */
  margin-top: 8px;
}
.ruler {
  display: block;
  width: 100%;
  height: 22px;
}
.ruler line {
  vector-effect: non-scaling-stroke;
}
.base {
  stroke: var(--color-border);
  stroke-width: 1;
}
.tick {
  stroke: var(--color-accent-text-btn);
  stroke-width: 2;
}
.tick.thin {
  stroke-width: 1;
}
.tick.end {
  stroke: var(--color-text);
  stroke-width: 2;
}
.stats {
  display: flex;
  justify-content: space-between;
  gap: var(--card-gap, 12px);
  margin: 0;
  font-size: 0.85em;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.stats div {
  display: flex;
  gap: 0.35em;
  min-width: 0;
}
.stats dt {
  opacity: 0.7;
}
.stats dd {
  margin: 0;
  font-weight: bold;
}
</style>
