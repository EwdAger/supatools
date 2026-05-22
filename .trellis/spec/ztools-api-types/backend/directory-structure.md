# Directory Structure

> Current structure expectations for `ztools-api-types`.

## Overview

In this repository, `ztools-api-types/` is currently an empty submodule directory and not a live backend source tree.

The actual source of truth for this package in this repo is:

- `scripts/sync-api-types.js`
- root `package.json` script `sync-api-types`

## Actual Rule

- Do not invent backend module structure for this package inside this repo.
- If changes are needed, first update the sync process or package-generation flow.
- If the submodule is later populated with real source files, this spec should be updated from that real codebase.

## Examples

- Sync entrypoint: `scripts/sync-api-types.js`
- Root command: `package.json` → `sync-api-types`
