# Logging Guidelines

> Current logging reality for `ztools-api-types`.

This package has no local backend logger in the repo. The only meaningful logging today is sync-script console output.

Current convention:

- Use straightforward console progress logs in the sync script.
- Keep messages operational and file-oriented.

Example:

- `scripts/sync-api-types.js`
