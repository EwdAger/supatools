# Quality Guidelines

> Quality expectations for `ztools-api-types` in this repo.

## Actual Rule

Do not write imaginary runtime backend conventions for this package while it has no local source checked out.

## Required Patterns

- Keep this package generation-driven.
- Update the sync script and generated package metadata together.
- Prefer reproducible sync behavior over manual edits inside generated outputs.

## Forbidden Patterns

- Do not add ad hoc backend modules under `ztools-api-types/` in this repo.
- Do not document architecture that does not exist yet.

## Example

- `scripts/sync-api-types.js`
