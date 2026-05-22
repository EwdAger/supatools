# Hook Guidelines

> Custom composable patterns in this project.

## Overview

Composables are used heavily for host integration and reusable interaction flows.

Examples:

- Sub-input lifecycle with host bridge: `internal-plugins/setting/src/composables/useZtoolsSubInput.ts`
- Jump/event integration: `internal-plugins/setting/src/composables/useJumpFunction.ts`
- Main search flows: `src/renderer/src/composables/useSearchResults.ts`

## Required Patterns

- Use composables when logic spans lifecycle hooks, browser events, and host APIs.
- Return explicit methods and refs instead of hidden side effects.
- Clean up listeners in `onUnmounted` or via composable helpers.

## Forbidden Patterns

- Do not hide one-off screen logic in a composable if it is only used once and makes the flow harder to follow.
- Do not let composables mutate unrelated module-global state unless that is their explicit purpose.

## Common Mistakes

- Registering host listeners without unregistering them.
- Putting heavy business logic into UI composables instead of backend or shared contracts.
- Over-generalizing composables before reuse actually exists.
