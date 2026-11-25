import { inject, onBeforeUnmount, shallowReactive, type InjectionKey } from 'vue'

/**
 * A toggle button a card's contents put in their rack card's header, next to the remove button
 * (e.g. Equal temperament's steps view). It takes no space in the card body.
 */
export type CardAction = {
  /** Key into `CARD_ACTION_ICONS`. */
  icon: CardActionIcon
  label: string
  pressed: () => boolean
  toggle: () => void
}

/** Header icons, as 24 x 24 stroke paths. */
export const CARD_ACTION_ICONS = {
  // A numbered list: the steps / degrees view.
  steps: 'M11 6h9 M11 12h9 M12 18h8 M4 16a2 2 0 1 1 4 0c0 .6-.5 1-1 1.5L4 20h4 M6 10V4L4 6'
} as const

export type CardActionIcon = keyof typeof CARD_ACTION_ICONS

export const CARD_ACTIONS: InjectionKey<CardAction[]> = Symbol('card-actions')

/** The list a `RackCard` renders in its header. */
export function createCardActions(): CardAction[] {
  return shallowReactive([])
}

/**
 * Puts `action` in the enclosing rack card's header while the calling component is mounted.
 * Does nothing outside a rack card (e.g. a card kept mounted out of sight).
 */
export function useCardAction(action: CardAction) {
  const actions = inject(CARD_ACTIONS, null)
  if (!actions) {
    return
  }
  actions.push(action)
  onBeforeUnmount(() => {
    const index = actions.indexOf(action)
    if (index >= 0) {
      actions.splice(index, 1)
    }
  })
}
