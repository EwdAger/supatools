# Type Safety

> The real role of `ztools-api-types` in this repo is type distribution.

## Overview

This package exists to publish or sync shared API type declarations. In this repo, the actual maintained logic is the sync script, not local implementation code.

## Current Conventions

- Treat this package as a generated/shared contract target.
- Keep type names and exported file structure aligned with the sync script output.
- Update generation logic in `scripts/sync-api-types.js` instead of manually patching many generated files.

## Example

- `scripts/sync-api-types.js`
