# Product

## Register

product

## Users

People in and around Rennes who want to know where their bus is, right now. Most are regulars — daily commuters, students, locals — who open the app on a phone, often at a stop or on the move, for a quick glance: is the bus coming, where is it, how full are the corridors today. A smaller share are occasional users (visitors, weekend trips) who just need to read the map without learning a system.

The context is mobile-first, outdoors, often interrupted, often one-handed. Sessions are short and frequent rather than long and deep. The user is rarely "exploring" — they have a question and want an answer in three seconds.

## Product Purpose

star-radar is a live map of the STAR public transport network in Rennes. It uses the STAR open API to render bus positions and route activity in real time, so anyone can see the network breathing instead of guessing from a static schedule.

It is a **radar**, not a trip planner. The job to be done is glanceable awareness of vehicle circulation — not multi-modal routing, not ticketing, not account management. Success looks like a Rennes local who pulls out their phone, sees the answer, and puts the phone away. A second surface (marketing / brand site) comes later; for now everything points to the app.

## Brand Personality

Alive, kinetic, local.

- **Alive** — the data is live, and the interface should feel that way. Vehicles ease between positions, lines pulse with current activity, arrivals tick. Movement comes from real signal, not decoration.
- **Kinetic** — energy at the right altitude. Things respond instantly, transitions are quick, the city feels present and in motion. Not frantic, not loud — taut.
- **Local** — this is *for and about Rennes*. The design carries specific local character (the colors of the actual STAR livery, the shape of the network, recognizable geography of the Vilaine and the Métro lines). A user in Lyon should not feel at home here.

The voice is civic and useful: confident, plain, helpful. French-first. No corporate growth language, no "Try Pro", no engagement bait.

## Anti-references

- **Outdated municipal / public-sector sites.** Heavy, slow, cluttered, 2010-era French gov UX. star-radar is a public-service tool but should not look like one.
- **Transit operations control rooms.** Dispatcher dashboards drowning in lines, codes, and warnings. Useful for ops, terrifying for a regular rider. Density only where it serves a glance.
- **Crypto / dark-mode bro startups.** Neon on black, glassmorphism, gradient text, "real-time" theatrics. Wrong tone for a civic app, even when the subject matter is real-time data.
- **Generic SaaS dashboards.** Hero metric cards, sidebar nav, identical card grids. A map app is not a dashboard.

## Design Principles

1. **Glance, don't browse.** Optimize for the 3-second check at a bus stop, not a long session. Hierarchy, density, and motion all serve the glance. If something cannot be answered in a glance, push it one level deeper rather than louder.

2. **The map is the product.** Cartography is the hero; chrome is supporting cast. UI competes with the map only when it must, never decoratively. When in doubt, give the map more room.

3. **Rennes, not "a French city".** Carry local specificity in cartography, color, and copy. The actual STAR livery hues, the actual line shapes, the actual neighborhoods. Generic transit aesthetics fail this principle.

4. **Aliveness comes from data, not decoration.** Buses move because they're moving. Lines pulse because there's activity. Animations exist when they encode real-time signal. No idle motion for vibe.

5. **Civic, not corporate.** Public-service tone — generous, plain, no growth-hacking patterns. Treat the user as a citizen, not a conversion.

## Accessibility & Inclusion

WCAG AA basics for this phase: color contrast meets AA, all interactive elements keyboard-reachable, all icons and map controls have accessible labels, copy is plain French. We accept that strict reduced-motion and colorblind-safe layers are not yet in scope, and revisit them before any public launch — the audience is the general Rennes public, so this is a known debt, not a non-goal.
