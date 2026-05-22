# State Management

> State patterns used in this project's frontend.

## Overview

The repo uses both Pinia and local component state.

- Use Pinia for app-wide renderer state, especially in `src/renderer/src/stores/`.
- Use local `ref/computed/watch` state inside the settings plugin views unless the state is shared across surfaces.

## Actual Patterns

- Main renderer search data and command caches live in Pinia: `src/renderer/src/stores/commandDataStore.ts`
- Settings plugin pages mostly manage state locally with `ref`, `computed`, and `watch`

Examples:

- Pinia store: `src/renderer/src/stores/commandDataStore.ts`
- Local screen state: `internal-plugins/setting/src/views/PluginsSetting/PluginsSetting.vue`

## Required Patterns

- Keep transient screen state local.
- Keep cross-screen or app-shell state in stores only when multiple consumers actually need it.
- Derive filtered/sorted UI lists with `computed` rather than mutating source arrays in place.

## Common Mistakes

- Promoting view-local modal/detail state into shared stores too early.
- Recomputing derived lists imperatively instead of using `computed`.
- Storing data that already has a backend source-of-truth and can be reloaded.
