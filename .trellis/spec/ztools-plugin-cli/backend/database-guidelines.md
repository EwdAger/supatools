# Database Guidelines

> Persistence patterns used in this repo's backend.

## Storage Technology

This project uses LMDB through `src/main/core/lmdb/` and exposes convenience APIs from
`src/main/api/shared/database.ts`.

## Actual Patterns

- Main-process code commonly uses `databaseAPI.dbGet/dbPut(...)` for simple document reads/writes.
- Shared database IPC handlers automatically namespace plugin data using `PLUGIN/{pluginName}/`.
- Host-owned data uses the `ZTOOLS/` namespace or plain top-level keys already established in the repo.

Examples:

- Namespace resolution and IPC wrapping: `src/main/api/shared/database.ts`
- LMDB singleton usage: `src/main/core/lmdb/lmdbInstance.ts`
- Simple array/doc persistence pattern: `src/main/core/remoteAgent/manager.ts`

## Required Patterns

- Preserve existing document keys; do not silently rename persistence keys.
- When adding plugin-owned data, respect plugin namespace isolation instead of inventing global keys.
- Keep persistence serialization close to the owning backend module.
- Prefer small document-shaped records over scattering related values across many unrelated keys.

## Forbidden Patterns

- Do not read/write plugin data directly from renderer Vue components.
- Do not bypass namespace helpers when code is acting on behalf of a plugin.
- Do not invent a second persistence abstraction when LMDB helpers already exist.

## Common Mistakes

- Forgetting that plugin-originated IPC calls automatically get prefixed in `database.ts`.
- Mixing machine-level state, machine-plugin config, and logs into a single document shape.
- Storing UI-only derived state instead of recomputing it from persisted source-of-truth records.
