---
name: Throughline Founder Dashboard
description: A private, decision-oriented hero dashboard for Throughline product health and OKR readiness.
colors: bg/primary, bg/secondary, bg/tertiary, border/light, border/default, text/primary, text/secondary, text/tertiary, icon/accent, blue/500, green/700, purple/500
typography: System Sans Variable, text/xs/normal, text/xs/semibold, text/sm/normal, text/sm/medium, heading/md/medium, heading/2xl
spacing: space-12, space-24
rounded: corner-radius/cr-24
surfaces: 1140px desktop, 800px content, 48px header, 24px gutter
components: top-bar, metric-card, report-block, chart-block, table-list, popover-menu
implementation: Canonical portable analytics artifact reader
---

## Overview

The default view answers one founder question: is Throughline healthy, are users reaching value, and what deserves attention next?

## Colors

Use bg/primary for the page, bg/secondary and bg/tertiary for hierarchy, border/light and border/default for separation, text/primary through text/tertiary for emphasis, icon/accent and blue/500 for Throughline actions, green/700 for healthy guardrails, and purple/500 sparingly for supporting context.

## Typography

Use System Sans Variable with text/xs/normal, text/xs/semibold, text/sm/normal, text/sm/medium, heading/md/medium, and heading/2xl tokens.

## Layout

Use a 1140px maximum surface, 800px reading measure where appropriate, a 48px top-bar, 24px gutters, space-12 for compact gaps, and space-24 for section rhythm.

## Elevation & Depth

Use elevation/01 only for metric-card and popover-menu separation. Prefer borders over shadows.

## Shapes

Use corner-radius/cr-24 for primary cards and smaller related radii for controls.

## Components

The top-bar establishes freshness; metric-card surfaces headline KRs; report-block holds sections; chart-block visualizes the value path; table-list carries readiness details; popover-menu exposes sources.

## Do's and Don'ts

Do keep status, readiness, and freshness visible. Do not infer product drop-off from coverage gaps or immature cohorts. Users can customize outputs by changing the generated artifact model rather than editing the portable reader.
