# Directory Structure

> How frontend code is organized in this project.

## Overview

The main split is by surface:

- `src/renderer/` = main application renderer UI
- `internal-plugins/setting/` = settings plugin UI

Inside each surface, code is grouped by views, reusable components, stores/composables, and utilities.

## Directory Layout

```text
src/renderer/src/
├── components/
├── composables/
├── stores/
└── utils/

internal-plugins/setting/src/
├── views/
├── components/
├── composables/
├── events/
├── utils/
└── router/
```

## Placement Rules

- Put top-level screens under `views/`.
- Put reusable UI building blocks under `components/`.
- Put host-bridge or reusable UI logic under `composables/`.
- Put small local helpers under `utils/` only when they are not component-specific.

Examples:

- Main plugin-center view: `internal-plugins/setting/src/views/PluginsSetting/PluginsSetting.vue`
- Market page: `internal-plugins/setting/src/views/PluginMarketSetting/PluginMarketSetting.vue`
- Shared detail overlay shell: `internal-plugins/setting/src/components/common/DetailPanel/DetailPanel.vue`
- Main search window store: `src/renderer/src/stores/commandDataStore.ts`

## Naming Conventions

- Vue SFC filenames use `PascalCase.vue`.
- Composables use `useXxx.ts`.
- Stores are descriptive nouns, e.g. `commandDataStore.ts`.
- Small feature-local helper files usually live beside the owning view/component.
