## <!-- SEED — re-run /impeccable document once there's code to capture the actual tokens and components. -->

name: star-radar
description: A live map of the STAR public transport network in Rennes

---

# Design System: star-radar

## 1. Overview

**Creative North Star: "The Living Network"**

star-radar is not a transit app pretending to be a dashboard. It is a live, breathing reading of Rennes' public transport, rendered in the operator's own colors on a map that does the actual work. Every choreographed transition encodes real-time signal: a bus easing toward its next position, a corridor pulsing with activity, a route fading because the line is sleeping. The map is not a backdrop for UI; the map IS the interface, and the chrome around it is supporting cast.

The system orbits around the STAR / Keolis Rennes operator red as its canonical anchor, with each line carrying its own operator-assigned color as a first-class named role. Type is humanist for prose and mono for the things that tick. Motion is choreographed not because we want flair, but because aliveness IS the product: the network moves, and the design moves with it. This is design that is alive, kinetic, local, civic, and Rennais.

What the system explicitly rejects, by name: the heavy 2010-era aesthetic of outdated French municipal sites, the cluttered density of a transit operations control room, the neon-on-black gradient theatrics of crypto / dark-mode bro startups, and the hero-metric card grids of generic SaaS dashboards. star-radar is none of those.

**Key Characteristics:**

- The map is the hero; chrome serves it.
- STAR's actual line colors are sacred and used cartographically.
- Motion is orchestrated and signal-bearing, never decorative.
- Numbers tick, lines breathe, vehicles ease — never snap.
- French-first, civic voice, no growth-marketing patterns.

## 2. Colors

The palette is the STAR network expressed as a design system: the operator's livery red as the anchor, the official line colors as named first-class roles, and Rennes-stone neutrals tinted toward the same red hue.

### Primary

- **STAR Operator Red** _[exact OKLCH to be resolved during implementation, anchored on Keolis Rennes' official livery red]_: the canonical brand hue. Used in the app shell, primary CTAs, the radar pulse, and (in cartography) as the line `a` color.

### Secondary / Tertiary — Network Lines

- **Line palette** _[exact OKLCH per line to be resolved during implementation, sourced from Keolis Rennes' official line color spec]_: every STAR line (a, b, C1–C7, regular bus lines) gets its own first-class slot in the system. These are not decorative — they are operator data rendered as color.

### Neutral

- **Granite** _[OKLCH TBD]_: the deepest body-text neutral, tinted toward operator red hue (chroma 0.005–0.01).
- **Slate** _[OKLCH TBD]_: cooler mid neutral for secondary surfaces, dividers, and inactive states.
- **Cream** _[OKLCH TBD]_: warm off-white for light surfaces. Never pure `#fff`.
- **Ink** _[OKLCH TBD]_: near-black for high-contrast text and the deepest surfaces. Never pure `#000`.

### Named Rules

**The Operator-Truth Rule.** Every color that represents a STAR network entity (line, route, mode) MUST be Keolis Rennes' official assigned color for that entity. We do not invent line colors. We do not adjust them for "design coherence". The line `a` is its livery red because the operator says so, and any tinted variant must still read as that red.

**The Glance Contrast Rule.** Where bus glyphs and line strokes sit on the map, contrast against the basemap MUST clear WCAG AA at the smallest rendered glyph size. If a STAR-assigned color fails this on a given basemap, we adjust the BASEMAP — never the line color.

**The Tinted-Neutrals Rule.** Every neutral is tinted toward the operator red hue (chroma 0.005–0.01). Pure `#000` and `#fff` are banned. The whole surface should feel quietly Rennais even before the user notices.

## 3. Typography

**Display Font:** _[humanist sans family — to be chosen at implementation]_
**Body Font:** _[same family as display, lighter / regular weights]_
**Label / Mono Font:** _[a clean mono — IBM Plex Mono, JetBrains Mono, or similar — to be chosen at implementation]_

**Character:** Humanist sans for prose so the voice reads warm and civic, not mechanical or anonymous. Mono for any string that ticks or codes — line names, stop codes, ETAs, vehicle IDs. The juxtaposition of breathing prose and counting numbers is part of the radar feel.

### Hierarchy

- **Display** _(weights TBD)_: rare. Hero headlines, big route or stop titles.
- **Headline** _(weights TBD)_: panel section headers.
- **Title** _(weights TBD)_: list-item headers, line and stop cards.
- **Body** _(weights TBD)_: prose and descriptions. Cap line length at 65–75ch.
- **Mono Label** _(weights TBD)_: line codes, stop codes, ETAs, vehicle IDs, all timestamps. Tabular figures required.

### Named Rules

**The Tabular-Mono Rule.** Anything that ticks (clocks, ETAs, distances, vehicle counts) MUST use mono with tabular figures. Proportional digits make the layout twitch on every update; that breaks "alive" into "jittery".

**The Code-Belongs-To-Mono Rule.** Line codes, stop codes, vehicle IDs are operator data, not prose. They render in mono regardless of surrounding context — even mid-sentence.

## 4. Elevation

The system is mostly flat — the map is the floor, and chrome floats above it as tonal layers, not stacked dropshadows. When elevation is genuinely needed (a panel rising over the map, a sheet entering from below), it appears as a single soft, large-radius shadow that reads almost as a glow. Hard 2010-era dropshadows are forbidden.

### Named Rules

**The Map-Floor Rule.** The map is the floor, not a layer. UI chrome floats above it; chrome cards never nest inside chrome cards.

## 5. Components

Omitted in seed mode — no implementation yet. Re-run `/impeccable document` once components exist to capture real tokens, variants, and the live panel snippets.

## 6. Do's and Don'ts

### Do:

- **Do** use STAR's official line colors verbatim for any line or route representation in the cartography.
- **Do** tint every neutral toward the operator red hue (chroma 0.005–0.01).
- **Do** use mono with tabular figures for any ticking value.
- **Do** ease bus positions between real-time updates with an exponential out curve. Never jump-cut.
- **Do** keep chrome minimal and let the map breathe.
- **Do** write copy in plain French. Civic, useful, no growth-marketing voice.
- **Do** orchestrate motion deliberately — entrances, sequenced reveals, pulse cycles — when motion encodes real signal.

### Don't:

- **Don't** adjust STAR line colors for design coherence. The colors are the operator's, not ours.
- **Don't** use `#000` or `#fff` anywhere.
- **Don't** wrap content in card grids on top of the map. Especially not nested cards.
- **Don't** use side-stripe borders (`border-left` / `border-right` > 1px as a colored accent). Banned across the system.
- **Don't** use gradient text or `background-clip: text` decoratively. Banned across the system.
- **Don't** use glassmorphism as a default. Rare and purposeful, or nothing.
- **Don't** ship motion that doesn't encode signal. Idle vibes-animation breaks the "aliveness comes from data, not decoration" rule.
- **Don't** look like an outdated French municipal site (heavy, cluttered, 2010-era).
- **Don't** look like a transit operations control room (dispatcher density terrifies regular riders).
- **Don't** look like a crypto / dark-mode bro startup (neon-on-black, glassmorphism, gradient text, "real-time" theatrics).
- **Don't** look like a generic SaaS dashboard (hero metric cards, sidebar nav, identical card grids).
- **Don't** treat the user as a conversion. No paywall language, no "Try Pro", no engagement bait. Citizens, not leads.
