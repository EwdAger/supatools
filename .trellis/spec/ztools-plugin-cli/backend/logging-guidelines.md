# Logging Guidelines

> Logging style used in this backend.

## Overview

Logging is mostly `console.log / console.warn / console.error` with a scope prefix.
This repo does not currently use a formal structured logger in most modules.

## Required Patterns

- Prefix logs with a subsystem label such as `[Plugins]`, `[Plugin]`, `[Database]`, `[API]`, `[Sync]`.
- Include enough context to debug the operation: plugin name, machine id, path, or action name.
- Use `console.error` for failures, `console.warn` for degraded-but-expected states, `console.log` for trace/debug output already common in the module.

Examples:

- `[Plugins]` install/update flow: `src/main/api/renderer/pluginInstaller.ts`
- `[Plugin]` runtime/session setup: `src/main/managers/pluginManager.ts`
- `[Database]` IPC persistence operations: `src/main/api/shared/database.ts`
- `[Sync]` WebDAV flow: `src/main/core/sync/syncEngine.ts`

## Forbidden Patterns

- Do not add unscoped `console.log('something')` messages in shared backend modules.
- Do not log sensitive payloads if they may contain credentials or user secrets.
- Do not introduce a second logging style inside a module that already uses a consistent prefix.

## Common Mistakes

- Logging only the error object without the business context.
- Using different prefixes for the same subsystem.
- Dumping large objects in hot paths where compact summaries would be enough.
