# Error Handling

> Current error-handling reality for `ztools-api-types`.

There is no local backend runtime here. The only real implementation path in this repo is the sync script.

Current convention:

- Fail fast in the sync script when upstream files cannot be fetched or transformed.
- Log progress and failures clearly in the script output.

Example:

- `scripts/sync-api-types.js`
