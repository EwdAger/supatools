# Backend Development Guidelines

> Actual backend conventions for the main Electron process and shared backend utilities in this repo.

## Overview

This package's backend code lives under `src/main/` plus a few shared helpers in `src/shared/`.
The codebase is organized by capability rather than by clean layered architecture. New work should
fit the existing capability modules first, then add small shared helpers only when reuse is real.

## Pre-Development Checklist

Before editing backend code for this package, read:

1. [Directory Structure](./directory-structure.md)
2. [Database Guidelines](./database-guidelines.md)
3. [Error Handling](./error-handling.md)
4. [Logging Guidelines](./logging-guidelines.md)
5. [Quality Guidelines](./quality-guidelines.md)

## Guides in This Layer

| Guide | Purpose |
|---|---|
| [Directory Structure](./directory-structure.md) | Where Electron main-process modules live and how new files should be placed |
| [Database Guidelines](./database-guidelines.md) | LMDB usage, namespace boundaries, and persistence patterns |
| [Error Handling](./error-handling.md) | How backend APIs report failures to renderer/plugin callers |
| [Logging Guidelines](./logging-guidelines.md) | Existing logging style using scoped `console.*` messages |
| [Quality Guidelines](./quality-guidelines.md) | Patterns to follow and patterns to avoid in backend code |
