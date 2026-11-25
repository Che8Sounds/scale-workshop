import type { Directive } from 'vue'

/**
 * Sizes a textarea to its content: one line by default (its CSS `min-height`), taller as more
 * lines are typed or wrapped, up to its CSS `max-height`, after which it scrolls.
 *
 * Refits on typing, whenever the owning component re-renders (so values set from elsewhere,
 * e.g. through `v-model`, are picked up) and when the textarea's width changes (re-wrapping).
 *
 * Textareas given the same value (`v-auto-grow="group"`, any object or other key) share one
 * height: the tallest content's. Side-by-side boxes then stay level (design/cards.md, e.g.
 * Equal temperament's relative steps and absolute degrees). Without a value each fits alone.
 */

type Group = Set<HTMLTextAreaElement>

const observers = new WeakMap<HTMLTextAreaElement, ResizeObserver>()
const listeners = new WeakMap<HTMLTextAreaElement, () => void>()
const widths = new WeakMap<HTMLTextAreaElement, number>()
const groups = new Map<unknown, Group>()
const groupOf = new WeakMap<HTMLTextAreaElement, Group>()

/** The height `el`'s content needs. */
function contentHeight(el: HTMLTextAreaElement) {
  // Collapse first so the field can shrink. Measure without a scrollbar: one appearing in the
  // collapsed box narrows it, wraps the text into an extra line, and that line's height would
  // stay as an empty line once the box is tall enough to lose the scrollbar again.
  const overflowY = el.style.overflowY
  el.style.height = 'auto'
  el.style.overflowY = 'hidden'
  const style = getComputedStyle(el)
  // With border-box sizing the borders come on top of scrollHeight.
  const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) || 0
  const height = el.scrollHeight + borders
  el.style.overflowY = overflowY
  return height
}

export function fitToContent(el: HTMLTextAreaElement) {
  const members = [...(groupOf.get(el) ?? [el])]
  const height = Math.max(...members.map(contentHeight))
  for (const member of members) {
    member.style.height = `${height}px`
  }
}

export const vAutoGrow: Directive<HTMLTextAreaElement, unknown> = {
  mounted(el, binding) {
    el.rows = 1
    if (binding.value !== undefined) {
      let group = groups.get(binding.value)
      if (!group) {
        group = new Set()
        groups.set(binding.value, group)
      }
      group.add(el)
      groupOf.set(el, group)
    }
    const fit = () => fitToContent(el)
    listeners.set(el, fit)
    el.addEventListener('input', fit)
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        // Only width changes re-wrap the text. Height changes are our own doing.
        if (widths.get(el) !== el.clientWidth) {
          widths.set(el, el.clientWidth)
          fit()
        }
      })
      observer.observe(el)
      observers.set(el, observer)
    }
    fit()
  },
  updated(el) {
    fitToContent(el)
  },
  beforeUnmount(el, binding) {
    const fit = listeners.get(el)
    if (fit) {
      el.removeEventListener('input', fit)
    }
    observers.get(el)?.disconnect()
    observers.delete(el)
    listeners.delete(el)
    widths.delete(el)
    const group = groupOf.get(el)
    if (group) {
      group.delete(el)
      groupOf.delete(el)
      if (!group.size) {
        groups.delete(binding.value)
      } else {
        // The others may have been held up by this one.
        fitToContent([...group][0])
      }
    }
  }
}
