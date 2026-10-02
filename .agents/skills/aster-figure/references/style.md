# The aster-figure style

The look comes from the figures of the kernelet book: a navy card with a blue glow at the top, a small
uppercase tag and a white title above, flat translucent boxes with thin strokes, monospace labels, and color
that means something. `css/figure.css` holds all of it; a figure's markup carries only geometry and classes.

## Contents

1. Figure anatomy
2. Canvases and when to use each
3. Color: the classes and what they mean
4. Text: sizes, widths, Chinese
5. Geometry conventions
6. Arrows
7. Patterns by figure type
8. The phone drawing
9. Accessibility and ids

## 1. Figure anatomy

```html
<figure class="aster-fig" id="fig-<slug>">              <!-- add lang="zh" for a Chinese figure -->
<div class="head">
<div class="tag">Short context, a few words</div>       <!-- uppercase by CSS; optional -->
<div class="title">The claim the figure makes</div>
</div>
<svg class="d" viewBox="0 0 860 H" role="img" aria-label="…">…</svg>
<svg class="m" viewBox="0 0 320 H" role="img" aria-label="…">…</svg>
<figcaption>One or two sentences: what to notice.</figcaption>   <!-- optional -->
</figure>
```

- The **title is a claim**, not a label: "Six states, one direction", not "Life cycle". The tag carries
  the label.
- No blank line anywhere inside `<figure>…</figure>`, and a blank line before and after it in the post.
  Markdown ends an HTML block at a blank line.
- HTML parts besides the head and caption:
  - `.cmp` with two or three `.col` children (add `.win` to the highlighted one); each column has a `.tag`,
    a `.name`, and a panel `<svg>`. Columns stack on phones.
  - `.stats` with `.stat` children (add `.o` to ours), each `<div class="num">` + `<div class="what">`.
    Numbers must be real and sourced from the post.

## 2. Canvases

| Canvas | Markup | viewBox width | Renders at | Use for |
|---|---|---|---|---|
| wide | `<svg class="d">` | 860 | 1:1 on a laptop | most figures; **needs an `.m`** |
| phone | `<svg class="m">` | 320 | ~1:1 on a 375px phone | the phone drawing of a `.d` |
| narrow | `<svg class="narrow">` | 320 | ~1:1 phone, ~1.4× desktop (max 440px) | small figures: a short stack, a bar chart |
| panel | `<svg>` in a `.cmp .col` | 300 | 0.85× desktop, ~1× phone | one option in a comparison |

Choose the smallest canvas that holds the idea. A figure that fits in 320 units should be `narrow`: one
drawing, nothing to keep in sync. Choose `wide` when the figure needs left-to-right room (a row of states,
two halves side by side, a pipeline of steps).

Height is whatever the content needs; leave 8–16 units of margin at the top and bottom.

## 3. Color

Never write a color, opacity or font in the markup. Put a class on the element or on a `<g>` of elements.
The meaning is fixed across the site:

| Meaning | Boxes | Lines | Text |
|---|---|---|---|
| neutral: other software, the host | (none) | (none) | `lbl` name, (none) body |
| hardware, a foundation | `base` | | `faint` |
| a large area holding boxes | `region` | | `cap` heading |
| a box nested in a box | `inset` | | |
| a competitor's extra layer | `muted` | | |
| neutral but belonging to ours | `tint` | | `lbl` |
| **ours** (Asterinas, the approach the post argues for) | `o` | `lo` | `ot` in the box, `oh` emphasis |
| ours, the star of the figure | `o hi` + `style="fill:url(#<prefix>-g)"` | | `ot` |
| an area that is ours | `o-region` | | `cap oh` heading |
| **risk**: unsafe, attack surface, shared trusted code | `risk` | `lr` | `rt`, `rn` detail |
| **cost**: overhead, slow path, extra work | `cost` | `la` | `at` |
| divider (user / kernel mode) | | `sep dash` | `ghost` |
| annotation: an edge label, a detail under a name | | | `note` |
| a number that must stand out | | | `wt` |

Charts: bars `bar` (neutral), `bar o`, `bar r`, `bar a`; `axis`; `grid`.

Helpers: `dash` (dashed stroke), `b` (bold), `mid` / `end` (text-anchor).

Rules of use:

- Cyan is scarce. One thing per figure is ours; if everything glows, nothing does. Use `o hi` for at most
  one row of boxes.
- Red and amber only when the post says that thing is a risk or a cost. Never for decoration or variety.
- Within one figure, the same kind of thing gets the same class everywhere.
- Box classes go on shapes or on a `<g>` of shapes; text classes on `<text>` or on a `<g>` of texts. Do
  not put a box class on a `<g>` that also contains text.

The gradient for `o hi` is declared in each `<svg>` that uses it:

```html
<defs><linearGradient id="<prefix>-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="g0"/><stop offset="100%" class="g1"/></linearGradient></defs>
```

## 4. Text

- **Font**: monospace inside drawings (set by the CSS). The head, caption and stats use the sans stack.
- **Sizes**, in viewBox units: 13 for names and body (the CSS default), 12 for annotations, edge labels,
  `cap` headings and anything secondary. **Nothing below 12.** 14–16 for a single headline inside a
  drawing, rarely.
- **Width budget**: a Latin character is 0.62 × font size wide; a Chinese character or full-width
  punctuation is 1.0 × font size. At 13: 8.1 units per Latin character, 13 per Chinese character. At 12:
  7.4 and 12. `cap` adds 1.2 units per character of letter-spacing.
- A box needs its text width plus at least 8 units on each side. Compute this before choosing box
  widths, not after.
- Line height: 15–16 units for 12-unit text, 16–18 for 13. Baselines inside a box of height h with one line:
  `y = top + h/2 + 4.5` (at 13) or `+ 4` (at 12).
- Write uppercase `cap` headings in uppercase yourself; the CSS does not transform SVG text.
- Shorten labels rather than shrink them: "guest OS", not "guest kernel" at size 10. Put detail in the
  caption or the post.
- **Chinese**: no `cap` letter-spacing on Chinese text (use `lbl` or `faint`); add `lang="zh"` on the
  `<figure>`; widths use the 1.0 rule. Mixed text: count each script separately. Keep technical names
  (`OSTD`, `microVM`, `endovisor`) in Latin.

## 5. Geometry

- Coordinates on a grid of 2; widths and gaps that repeat should be exactly equal.
- Corner radius: 5 for small boxes (height ≤ 32), 6 for normal boxes, 8–10 for regions.
- Margins: 16–24 units from the canvas edge on `d`; 4–10 on `m`, `narrow` and panels.
- Gaps between sibling boxes: 14–16 units (wide), 6–10 (phone). Leave 26–40 when an arrow and label sit
  in the gap.
- Stacks are read top to bottom from user-facing to hardware: tenants, then kernels, then the core, then
  hardware as a `base` strip at the bottom.
- A region's `cap` heading sits inside the region, at its top-left or centered at its bottom.

## 6. Arrows

Declare markers per `<svg>` with prefixed ids, one per color used:

```html
<marker id="<prefix>-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk o" d="M0 0 L8 4 L0 8 z"/></marker>
<marker id="<prefix>-n" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0 0 L8 4 L0 8 z"/></marker>
```

(`mk` gray, `mk o` cyan, `mk r` red, `mk a` amber.) Use them as `<path class="lo" d="…" marker-end="url(#<prefix>-a)"/>`.

- Arrows are orthogonal: `H` and `V` segments, no diagonals, no curves.
- End an arrow 2 units short of the box it points at, so the head touches the edge.
- The main path is `lo` (cyan); exceptional or alternative paths are gray `dash`.
- Edge labels are `note` at 12, centered under a horizontal arrow or left-aligned to the right of a
  vertical one, and never cross a box.

## 7. Patterns

**Comparison** (`.cmp`, panels of 300): the same skeleton in every column, so the eye compares like with
like: tenants at the top, then what isolates them, then `base` hardware at the same y in every panel. The
difference between options should be visible as a difference in shape, not only in text. Example:
`examples/compare.html`.

**Layered stack** (`d` + `m`, or `narrow`): horizontal bands, user mode above a `sep dash` divider with
`ghost` "user mode" / "kernel mode" labels, `region` for a kernel that holds parts, `base` hardware.
Put ours on the right when contrasting with today's way. Example: `examples/stack.html`.

**Flow, sequence, state machine** (`d` + `m`): on `d` a left-to-right row; on `m` a top-to-bottom column
with labels to the right of the arrows. Number steps in a `cap` heading inside each box ("1 LINUX · WATCH
TIMER") when there are more than three. Example: `examples/states.html`.

**Chart** (`narrow`, or `d` + `m`): horizontal bars for comparing a few systems (labels stay readable);
value at the end of each bar in the bar's text color; a light `grid` and an `axis`; ours is `bar o`, a
costly baseline may be `bar a`, others `bar`. State the unit. Never draw numbers the post does not
give. Example: `examples/chart-zh.html` (its numbers are placeholders).

**Stats** (`.stats`): two to four numbers that the post states, ours marked `.o`. Example:
`examples/chart-zh.html`.

## 8. The phone drawing

The `.m` drawing says the same thing as the `.d` drawing, re-laid for a narrow screen, not shrunk:

- Rows become columns: a left-to-right chain becomes a top-to-bottom chain.
- Repeated items collapse: three tenant boxes become one box "agents A · B · C".
- Long labels break into two lines or get a shorter wording; details move to the caption.
- Every box, color and arrow in `.d` that carries meaning has a counterpart in `.m`. The `aria-label`
  may differ only where the content does.

## 9. Accessibility and ids

- Every `<svg>` has `role="img"` and an `aria-label` that states what the drawing shows, as prose a
  screen-reader user could follow without the picture: the parts, how they connect, what is highlighted.
- The `<figure>` id is `fig-<slug>`, where the slug is short and unique within the post. Every id inside
  an `<svg>` starts with `<slug>-` and is unique on the page, including between `.d` and `.m`
  (use `<slug>-dg` and `<slug>-mg`, `<slug>-da` and `<slug>-ma`).
