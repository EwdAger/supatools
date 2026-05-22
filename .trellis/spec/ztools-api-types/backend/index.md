# Backend Development Guidelines

> Current reality for `ztools-api-types` in this repository.

## Overview

This package is not checked out as active source code in the current repo working tree. In this repository, `ztools-api-types/` is effectively treated as a generated or synchronized artifact target, not as a locally developed backend codebase.

The real behavior in this repo is:

- type package content is produced by `scripts/sync-api-types.js`
- package metadata is maintained by that sync flow
- there is no local backend runtime implementation under `ztools-api-types/`

## Pre-Development Checklist

Before editing anything related to this package, read:

1. [Directory Structure](./directory-structure.md)
2. [Quality Guidelines](./quality-guidelines.md)

Read the other backend guides only if this package later gains real local source files.

## Guides in This Layer

| Guide | Purpose |
|---|---|
| [Directory Structure](./directory-structure.md) | Explains the package is currently sync-driven, not locally implemented |
| [Database Guidelines](./database-guidelines.md) | Documents that no backend database layer exists here today |
| [Error Handling](./error-handling.md) | Documents sync-script level error expectations |
| [Logging Guidelines](./logging-guidelines.md) | Documents script-style console logging used for sync |
| [Quality Guidelines](./quality-guidelines.md) | Explains how to modify this package without inventing nonexistent runtime patterns |
