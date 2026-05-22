# Directory Structure

> How backend code is organized in this project.

## Overview

Backend code is grouped by runtime capability, not by abstract service/domain layers.
Most work belongs in `src/main/`. Shared runtime contracts that both main and renderer/plugin code
consume belong in `src/shared/`.

## Directory Layout

```text
src/main/
├── api/
│   ├── index.ts                 # central API bootstrap
│   ├── renderer/                # IPC/API surface for the main renderer
│   ├── plugin/                  # IPC/API surface exposed to plugins
│   └── shared/                  # shared backend APIs (database, clipboard, image analysis)
├── core/                        # long-lived runtime subsystems
├── managers/                    # stateful managers coordinating windows/plugins/clipboard
├── common/                      # local constants and small helpers
└── utils/                       # low-level utilities

src/shared/
└── *.ts                         # shared data contracts and normalization helpers
```

## Module Organization

- Put API entrypoints in `src/main/api/**`.
- Put stateful, long-lived subsystems in `src/main/core/**` or `src/main/managers/**`.
- Put pure reusable contracts or normalizers in `src/shared/**`.
- Prefer extending an existing capability module before creating a new top-level folder.

Examples:

- API bootstrap and cross-module initialization: `src/main/api/index.ts`
- Plugin lifecycle/runtime orchestration: `src/main/managers/pluginManager.ts`
- Persistent storage and namespacing: `src/main/api/shared/database.ts`
- Remote machine feature domain: `src/main/core/remoteAgent/manager.ts`

## Naming Conventions

- Files use `camelCase.ts`.
- Manager classes use `*Manager` names.
- API classes use `*API`.
- Shared contracts use descriptive nouns, e.g. `pluginRuntimeNamespace.ts`.

## Placement Rules

- Do not put renderer-facing IPC handlers into random utilities; keep them under `api/`.
- Do not put persistence schemas inside Vue views; keep shared contracts under `src/shared/`.
- Do not add a new helper file before searching for an existing capability module that already owns the behavior.

## Examples

- `src/main/api/renderer/plugins.ts`
- `src/main/api/plugin/internal.ts`
- `src/main/core/sync/syncEngine.ts`
- `src/main/core/remoteAgent/onboardingService.ts`
