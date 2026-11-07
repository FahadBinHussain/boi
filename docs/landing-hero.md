# How the landing hero is built

Scope: the `/` landing hero of [boi](https://iboi.vercel.app), measured in Edge
(Chromium) at a 1440×1000 viewport against the local dev build of commit
`60ddb12`, on 2026-11-04. Every number below is **measured** unless it is
tagged *derived* or *inferred*. Palette claims use the vocabulary of
`better-colors`, type claims the vocabulary of `better-typography`.

This is an explanation, not a review. It names the layers that produce what
the reader sees and how each one works.

## The stack, in paint order

The hero is a `relative isolate` section 90dvh tall with `overflow: hidden`.
`isolate` makes it its own stacking context, so everything below is resolved
inside it and nothing escapes to the page. Five layers paint, bottom to top.

### 1. The field — `bg-base-100`

The page wrapper's own background. It is the only opaque layer, and every
other layer in the hero is translucent over it.

### 2. The wash — `bg-gradient-to-br from-base-100 via-base-200/50 to-base-100`

*Measured:* `linear-gradient(to right bottom, oklch(0.253267 0.015896 252.418),
oklch(0.232607 0.013807 253.101 / 0.5), oklch(0.253267 0.015896 252.418))` in the
dark theme — a 135° three-stop ramp that starts and ends on `base-100` and dips
to a half-alpha `base-200` in the middle.

*Derived:* the middle stop is the only one doing work, and it is only half
opaque, so the wash is a 1-stop vignette rather than a colour field. It gives
the hero a soft diagonal lightening without introducing a hue of its own.

### 3. The three orbs — `bg-primary/10 blur-[90px]`, `bg-secondary/10 blur-[100px]`, `bg-accent/10 blur-[110px]`

*Measured:* three 500px, 450px and 350px squares with `border-radius: 9999px`,
`filter: blur(90px) / blur(100px) / blur(110px)`, and backgrounds
`oklch(0.6569 0.196 275.75 / 0.1)` (primary), `oklch(0.748 0.26 342.55 / 0.1)`
(secondary) and `oklch(0.7451 0.167 183.61 / 0.1)` (accent).

Each is animated on a loop: x drifts ±30, ±40 and ±20px while y drifts ±20,
±30 and ±40px over 20s, 25s and 18s, with 0s, 2s and 1s of delay so they
never line up. *Measured from source*, not from the page: the automation tab
is backgrounded, so its `requestAnimationFrame` clock is throttled to nothing
and the transform never leaves its rest value (`transform: none`,
`getAnimations()` empty). That is the same frame-clock behaviour the project
already documents for entrance animations.

*Derived:* a 90px blur on a 500px circle is roughly three times the circle's
radius. The blur is not a soft edge on a shape, it is the shape. Each orb
contributes a diffuse field of one hue at 10% alpha, which is why the hero
reads as tinted light rather than as three objects.

### 4. The grid — two 1px `currentColor` lines on a 64px pitch, masked

*Measured:* `linear-gradient(<currentColor> 1px, transparent 1px)` plus its
90° twin, `background-size: 64px 64px`, `opacity: 0.03`, with
`mask-image: radial-gradient(60% 60%, black 30%, transparent 70%)`.

The mask is what makes it work: the lines are drawn everywhere and then faded
out radially, so the grid is legible only around the middle of the hero and
dissolves before it reaches the edges. At 3% opacity the colour barely
registers on its own — what the reader sees is the *structure* of the mask.

### 5. The headline — two spans, one of them a stencil

The `h1` is `text-5xl/[1.25] lg:text-7xl/[1.1]`, so *measured* at this
viewport it is 72px on a 79.2px line, weight 800, letter-spacing -1.8px, in
Inter. It holds two children:

- `Discover better books` — plain `text-base-content`, *measured*
  `oklch(0.746477 0.0216 264.436)` in dark, `oklch(0.278078 0.029596 256.848)`
  in light.
- `with less noise.` — `text-transparent bg-clip-text bg-gradient-to-r
  from-primary to-secondary`.

The second span is the effect, and it is three declarations doing three
different jobs:

- `color: rgba(0, 0, 0, 0)` — *measured* — removes the text's own fill. The
  glyphs stop being ink and become a hole.
- `background-image: linear-gradient(to right, oklch(0.6569 0.196 275.75),
  oklch(0.748 0.26 342.55))` — *measured* — a two-stop 90° ramp from
  `primary` to `secondary`, painted into the element's background box.
- `background-clip: text` — *measured* — clips that background to the glyph
  shapes, so the ramp is only visible where the letters are.

The order matters and is not interchangeable: clipping the gradient to the
text is what makes the glyphs a stencil, and making the fill transparent is
what stops a solid colour from painting over the clip.

*Derived:* the gradient is painted across the span's own inline box, *measured*
526px wide, while the `h1` is 699px wide (`max-w-[20ch]`). The ramp therefore
runs from the left edge of "with" to the right edge of "noise." and no
further — it is a 526px sweep, not a page-wide one, and it re-flows with the
line rather than being pinned to the viewport.

*Measured:* the two stop colours are DaisyUI's `primary` and `secondary`
tokens, so the sweep re-points when the theme changes — in light it becomes
`oklch(0.4912 0.3096 275.75)` to `oklch(0.6971 0.329 342.55)`, in dark
`oklch(0.6569 0.196 275.75)` to `oklch(0.748 0.26 342.55)`. The ramp is
rebuilt from the theme, not hardcoded, which is why 32 themes work.

*Measured:* `::before` and `::after` on the span are both `content: none` and
carry no background. There is no glow, no shadow and no second gradient
layer behind the text. The apparent depth comes from the orbs behind it, not
from anything attached to the glyphs.

### 6. The film — a fixed noise overlay above everything

*Measured:* `position: fixed`, `inset: 0`, `z-index: 100`,
`opacity: 0.03`, `mix-blend-mode: overlay`, `pointer-events: none`, painting a
310-character inline SVG data URI — a 256×256 `feTurbulence` tile
(`baseFrequency: 0.9`, 4 octaves) repeated across the viewport.

This is the one layer above the content rather than behind it. At 3% in
`overlay` blend mode it contributes almost no luminance of its own; what it
does is break up the banding that a large, low-contrast gradient wash would
otherwise show on a wide screen. It is a defect-hider, not a decoration.

## The two motions

**Entrance.** `useEntranceAnimation('hidden', 'show')` drives a stagger
container over the hero column: `delayChildren: 0.2` and `staggerChildren:
0.12` between children, each child running `fadeInUp` — opacity 0→1, y 40→0,
`filter: blur(8px)`→`blur(0px)` over 0.8s. *Inferred from source:* the column
holds four staggered children (the badge, the headline, the lede and the
button row), so they land at roughly 0.2s, 0.32s, 0.44s and 0.56s, each
running its own 0.8s. The last one is still arriving as the first has
settled. The blur is what makes it read as depth rather than as a slide.

**Scroll.** The hero column carries `opacity: useTransform(scrollYProgress,
[0, 0.25], [1, 0])` and `scale: useTransform(scrollYProgress, [0, 0.25], [1,
0.98])`. *Derived:* the whole hero is gone by a quarter of the page's scroll
range, and it shrinks by 2% while it goes. That is a parallax-ish exit, not a
scroll-linked animation in the strict sense — no element moves against the
scroll, the group just recedes.

## The recipe, in words

A headline is two spans: one in the page's own content colour, one whose fill
is removed and whose background is a two-stop horizontal ramp clipped to the
glyphs, so the letters become a stencil for the ramp. Behind the headline sit
three blurred discs — a quarter of a stop of primary, secondary and accent
at 10% alpha, blurred by 90-110px and drifting on slow offset loops — over a
diagonal wash that starts and ends on the page colour, under a 64px grid that
is only legible inside a radial mask. Over everything sits a 3% film of
generated noise in overlay blend, which hides the banding the wash would
otherwise show.

## What would not survive being copied

- The gradient is bound to two DaisyUI theme tokens. Copy the ramp and it
  stops re-pointing with the theme; copy the tokens and it inherits whatever
  the host's palette is.
- The three orb hues are the app's own `primary`/`secondary`/`accent`. Their
  10% alpha is tuned against this page's base colour — a different base
  changes how far they read.
- The 90-110px blur radii are tuned against 350-500px discs on a 1440px
  viewport. Scale one without the other and the orbs turn into flat discs.
- The ramp's direction is `to right`, and the span is an inline box that
  re-flows with the line. A fixed-direction ramp over a different measure
  lands its mid-tones somewhere else.
- Inter at 800 with -1.8px tracking is what makes the stencil read; a
  different face changes the glyph outlines the clip cuts.

## What I could not read

- The orb drift was not sampled from the page: the automation tab is
  backgrounded, so the `requestAnimationFrame` clock that drives it is
  throttled to nothing and the transforms stayed at rest. The amplitudes and
  durations come from the source, not from the rendered page.
- The entrance animation had already finished by the time the page was
  measured, so its timing was read from the variant definitions rather than
  sampled during the reveal.
- The two theme colours were read by flipping `data-theme` on the document.
  The project's own colour rules note that a backgrounded tab pauses CSS
  transitions, so the values are the settled end state, not a mid-transition
  frame.
