# Type Safety

> Type safety patterns in this project.

## Overview

This repo uses TypeScript everywhere, but real code mixes strong typing with pragmatic `any` at IPC and plugin-manifest boundaries. The guideline is to improve local clarity without pretending the whole app is already fully typed end-to-end.

## Type Organization

- Shared contracts belong in `src/shared/**`.
- Renderer/store-local interfaces usually live at the top of the owning file.
- Built-in plugin environment types live in `internal-plugins/setting/src/env.d.ts`.

Examples:

- Shared runtime contract file: `src/shared/commandShared.ts`
- Local screen interfaces: `internal-plugins/setting/src/views/PluginMarketSetting/PluginMarketSetting.vue`
- Store-local command types: `src/renderer/src/stores/commandDataStore.ts`

## Required Patterns

- Add explicit interfaces for non-trivial state and payloads.
- Prefer narrowing and small helper functions over broad unchecked assertions.
- Keep `any` at outer boundaries only when the upstream payload is genuinely untyped today.

## Forbidden Patterns

- Do not spread `any` deeper into pure helpers when you can normalize once at the boundary.
- Do not invent duplicate local copies of a shared contract if `src/shared/**` already owns it.

## Common Mistakes

- Treating host IPC results as fully trusted without a local shape check.
- Reusing one huge `any` plugin object through multiple layers instead of deriving a smaller typed local view model.
