---
name: aster-figure
description: Draw a figure for a post on the Asterinas website (asterinas.github.io) in the house style, an inline-SVG diagram on a dark navy card styled by css/figure.css, and insert it into the post. Use when the user asks for a figure, diagram, illustration, chart, architecture drawing, comparison, flow, timeline or state machine in a blog post under _posts/, in English or Chinese, or asks to redraw, fix or restyle such a figure.
---

# aster-figure

Turns a description of a figure into a `<figure class="aster-fig">` of inline SVG, inserted into a post in
`_posts/`. The look (navy card, monospace labels, translucent boxes, color with fixed meaning) lives in
`css/figure.css`; a figure carries only geometry and classes.

Inputs: the description, the target post, and optionally the paragraph the figure follows. If the post is
not named, ask for it.

Read before drawing:

- `references/style.md`: canvases, color classes, text sizes and widths, geometry, patterns. Always.
- The example closest to the figure in `references/examples/`:
  - `compare.html`: side-by-side options, one highlighted (`.cmp` panels)
  - `stack.html`: layered architecture, a wide drawing plus its phone drawing
  - `states.html`: states or steps joined by arrows, a row on desktop and a column on phones
  - `chart-zh.html`: a bar chart and stat tiles on the narrow canvas, in Chinese. Its numbers are
    placeholders; never reuse them.

## Workflow

### 1. Understand

Read the whole post. Note the terms it uses for each part (draw "endovisor", not "hypervisor module", if
that is the post's word), the claim the figure should support, and where it goes. Every box, label and
number in the figure must come from the post or the user's description. If the description and the post
disagree, or a fact the figure needs is missing, ask; do not invent it.

### 2. Sketch, then wait

Before writing any SVG, show the user a sketch and wait for an OK:

- **Type and canvas**: e.g. "layered stack, wide (`d` + `m`)" or "bar chart, narrow".
- **Tag and title**: the title states the claim.
- **Layout**: an ASCII drawing of the desktop figure, and of the phone drawing if there is one.
- **Parts**: every box and label with its color class and why (`o`: ours; `risk`: the shared kernel the
  post calls the attack surface; …), and every arrow with its label.
- **Caption**, if any.

Revise until the user approves. Keep the sketch short; it exists so that changing the plan costs one
message and not a redraw.

### 3. Draw

- Size boxes from the text they hold, using the width budget in `style.md` §4 (Latin 0.62 × size,
  Chinese 1.0 × size, plus 8 units of padding each side), before placing anything.
- Lay out on a grid of 2 with equal repeated widths and gaps.
- Classes only: no colors, opacities, fonts or `style` attributes except `style="fill:url(#…)"` on an
  `o hi` box. Font sizes 12 or 13, rarely more.
- For a `d` drawing, draw the `m` drawing as a re-layout (`style.md` §8), not a scaled copy.
- Write the `aria-label` for each drawing as prose that describes it.

### 4. Insert

Put the figure in the post after the anchor paragraph, with a blank line before and after it and none
inside it. Posts use `_layouts/post.html`, which links `/css/figure.css`; if the post uses another
layout, link the stylesheet there too.

If the figure needs something the stylesheet does not have, add it to `css/figure.css` as a new class with a
comment saying what it means, add it to `style.md`, and tell the user. Do not change an existing class's
color; every figure on the site depends on it.

### 5. Render and check

```sh
node .agents/skills/aster-figure/scripts/render.mjs _posts/<post>.markdown --fig fig-<slug> --out <scratchpad>/render
```

This builds the site, renders the post at 1280px and at 375px, and writes
`<scratchpad>/render/fig-<slug>-desktop.png` and `-mobile.png`. It also checks the markup and the
rendered figure. Fix every `ERROR` and re-run; a `WARN` needs a reason to keep. (For a draft not yet in a
post, `--snippet FILE.html` renders a bare `<figure>` inside a post page.)

Then **look at both screenshots** with the Read tool. The checker cannot see these, so check them yourself:

- Does each arrow start and end at a box edge, with its head visible?
- Are rows aligned, gaps equal, and the drawing balanced, without empty corners or crowded edges?
- Is cyan on one thing only, and does every red or amber thing match a risk or cost in the post?
- Does the phone drawing say everything the desktop one says?
- Does the title read as a claim, and can a reader get the point in five seconds?

Fix what you find and render again. Do not stop at a figure you have not looked at.

### 6. Report

Tell the user where the figure went, show the two screenshot paths, and list anything you added to
`css/figure.css` or left as a warning. Do not commit unless asked.
