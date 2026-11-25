# Card design

Living notes for the Build Scale rack cards. Every generator and modifier card follows these.
Equal temperament is the reference card: new rules get tried there first, then rolled out.

Sections are split into **Agreed** (build to this) and **Proposed** (not decided yet).

## Canvas

- The rack is **vertical**, in the left column of Build Scale (unlike Performer's horizontal rack).
- Build Scale is three equal columns from 1100px up, so a card is `viewport width / 3 - 32px`:

  | Window | Card width |
  | ------ | ---------- |
  | 1920 (design target, 16:9 full screen) | 602px |
  | 1728 (MacBook Pro 16") | 544px |
  | 1440 | 448px |
  | 1100 (smallest 3-column window) | ~335px |

- Design at 602px, check at 448px. Below 1100px the layout drops to two columns, then one.

## Agreed

### 1. Symmetry

One inset value, `--card-inset`, on all four sides of the card body:
top rule to the first label = last box to the bottom edge = left edge = right edge.
The header uses the same horizontal inset: the chevron icon's left edge and the × icon's right
edge sit on the inset lines (their 32px hit areas overhang into it), so the header's icons line up
with the labels and boxes below them. The header's top and bottom padding are equal too.

Nothing else adds space at the edges. The global `.control-group` margin (1.5rem top and bottom)
is what makes today's ET card bottom-heavy, so cards don't use it.

### 2. Text is centered in every box

Whatever the box holds (number slider, pitch field, text input, step list), its text is centered
horizontally and vertically. Vertical centering comes from the box height and line height, not from
padding (`.card-input` does this for text boxes).

### 3. Pitch values are pitch fields

Any field that holds a pitch (interval to divide, equave, period, generator) is a TextSlider pitch
field, exactly like Performer's `OCTextSlider` with `keepsRatio`:

- **Typing** takes either spelling. A token with `/` is a ratio, anything else is cents
  (`702` means 702 cents, not 702/1).
- **A typed ratio is kept** and shown as typed (`3/2`, no unit) when both terms are whole numbers
  up to 9999. It is reduced (`6/4` shows `3/2`). Any other ratio (`3.5/2`) applies but shows as cents.
- **A ratio outside the field's range is refused**, not clamped, since a clamped ratio is not the
  ratio that was typed.
- **Hovering** a field that shows a ratio shows its cents instead, at 85% of the ink, previewing
  what a drag would leave. The box never resizes for the hover.
- **Anything that moves the value drops the ratio** (drag, arrow nudge, reset to a cents default),
  and the field shows cents from then on.
- **Double-click** resets to the field's default, which can be a ratio (the equave's `2/1`).
- **Modifiers** (pitch fields only): Shift is 0.1x, Cmd (Ctrl off the Mac) is 10x, Cmd wins when
  both are held. Same factors for drag and arrow keys. One arrow press is 1 cent.
- **Output to SonicWeave**: a kept ratio is written as the ratio (`3/2`), cents as a cents
  literal with a decimal point (`701.955`).

Open question (see Proposed): in SonicWeave a bare `3` means 3/1 (the tritave). Under the
Performer rule it means 3 cents, so a tritave is typed `3/1`.

### 4. TextSlider edge brightness

- Unfocused edge: accent at 48% (what focused uses today).
- Focused or dragging: accent at 96% (double).

### 5. Collapse chevron

The header chevron is a real icon, at least 18px, in a 32 x 32px hit area. Today's `▾` glyph is
too small to see or hit.

### 6. Labels

Same size as before the redesign (bold, base 15px), centered over their box, sentence case.
Text sizes in general stay as they were on the site; the redesign is about layout, not type.

### 7. Secondary controls live behind a header icon

The 1 to 3 controls that define the scale sit at the top of the body. Refinements (ET's relative
steps and absolute degrees) are hidden until a toggle icon in the card header, next to ×, shows them.
The toggle takes no space in the body. A full-width disclosure row was tried and cost too much height.
The choice outlives the card body, so closing and reopening the card keeps it.

### 8. One control skin

Every box (number slider, pitch field, text box) shares the TextSlider's fill, edge, 6px radius and
36px height. Text boxes that hold SonicWeave (step lists, degree lists) use a monospace font.

### 9. Boxes side by side stay level

Boxes that sit next to each other in a row share one height: the taller content's, whichever box
that is. Neither box is the "leader": ET's absolute degrees usually wrap first (multi-digit
numbers), but relative steps can be the longer one (negative or large steps), so both follow the max.
Text boxes join a height group with `v-auto-grow="group"` (any shared object).

## Built

| Piece | Where | What it does |
| ----- | ----- | ------------ |
| Card tokens | `RackCard.vue` (`.rack-card`) | `--card-inset` 16px, `--card-gap` 12px, `--control-h` 36px, `--icon-size` 20px, `--icon-box` 32px |
| Header actions | `src/rack/card-actions.ts` | `useCardAction()` puts a toggle icon in the enclosing card's header (principle 7) |
| Layout classes | `src/assets/card.css` | `.card-stack`, `.card-grid` (two per row), `.card-field` (centered label over a control), `.card-input` (text box skin, centered text) |
| Pitch field | `TextSlider.vue`, `pitch` prop | Principle 3. Emits `pitch` with the cents and the kept ratio |
| Readout | `src/components/rack/CardReadout.vue` | Mini pitch ruler plus a row of stats |

Equal temperament is the first card built from these.

## Proposed

Not decided yet.

- **Readout strip.** The ruler plus stats (step size, note count, equave in cents) under the
  controls, 8px further from them than the card gap (20px in all), since it shows results rather
  than settings. Built on ET to try it; every generator could reuse it.
- **Typing a bare number in a pitch field.** Performer reads `3` as 3 cents (built that way now).
  SonicWeave reads `3` as 3/1 and needs `3.` or `3c` for cents.
