import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { vAutoGrow } from '../auto-grow'

let wrapper: VueWrapper

afterEach(() => {
  wrapper?.unmount()
  document.body.replaceChildren()
})

// jsdom has no layout: give each textarea the content height its text would need.
function fakeContentHeight(el: HTMLTextAreaElement) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => 20 * el.value.split('\n').length
  })
}

function mountPair() {
  const showSecond = ref(true)
  const Pair = defineComponent({
    directives: { autoGrow: vAutoGrow },
    setup: () => ({ group: {}, showSecond, a: ref('1'), b: ref('1\n2\n3') }),
    template: `
      <div>
        <textarea class="a" v-model="a" v-auto-grow="group"></textarea>
        <textarea v-if="showSecond" class="b" v-model="b" v-auto-grow="group"></textarea>
      </div>`
  })
  // Install the fake before the directive's first fit.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight')
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return 20 * this.value.split('\n').length
    }
  })
  wrapper = mount(Pair, { attachTo: document.body })
  if (descriptor) {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', descriptor)
  }
  const a = wrapper.find('.a').element as HTMLTextAreaElement
  const b = wrapper.find('.b').element as HTMLTextAreaElement
  fakeContentHeight(a)
  fakeContentHeight(b)
  return { a, b, showSecond }
}

describe('vAutoGrow', () => {
  it('gives textareas in one group the tallest content height', async () => {
    const { a, b } = mountPair()
    expect(a.style.height).toBe('60px')
    expect(b.style.height).toBe('60px')
  })

  it('follows whichever box grows', async () => {
    const { a, b } = mountPair()
    a.value = '1\n2\n3\n4'
    a.dispatchEvent(new Event('input'))
    expect(a.style.height).toBe('80px')
    expect(b.style.height).toBe('80px')
  })

  it('lets the rest shrink back when the tall one leaves', async () => {
    const { a, showSecond } = mountPair()
    showSecond.value = false
    await nextTick()
    expect(a.style.height).toBe('20px')
  })

  it('measures without a scrollbar and restores the overflow afterwards', async () => {
    const { a } = mountPair()
    expect(a.style.overflowY).toBe('')
  })
})
