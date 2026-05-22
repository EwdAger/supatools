# Error Handling

> How backend code reports failures in this project.

## Overview

The dominant style is pragmatic and API-oriented:

- log the error in the backend
- return a structured `{ success: false, error: string }` result to the caller
- reserve thrown exceptions for internal invariant failures or low-level helpers

## Required Patterns

- Renderer-facing and plugin-facing APIs should usually return success/error objects.
- Validate required input early and return a readable error string.
- Catch low-level exceptions at API boundaries and convert them into stable results.

Examples:

- Plugin install API returns `{ success: false, error }`: `src/main/api/renderer/pluginInstaller.ts`
- Internal API guards and permission failures: `src/main/api/plugin/internal.ts`
- API manager wrappers around risky operations: `src/main/api/index.ts`

## Preferred Error Shape

At API boundaries, prefer:

```ts
return { success: false, error: 'message' }
```

instead of leaking raw exceptions into renderer code.

## Forbidden Patterns

- Do not let raw `unknown` exceptions escape from renderer/plugin IPC handlers.
- Do not swallow errors silently.
- Do not return partially valid objects without a `success` flag when the surrounding API already uses success/error envelopes.

## Common Mistakes

- Logging an error but still returning a success-like value.
- Throwing from a renderer-facing API where the rest of the module returns structured failures.
- Using inconsistent error strings for the same condition across multiple handlers.
