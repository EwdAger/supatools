# Frontend Development Guidelines

> Actual frontend conventions for `src/renderer/` and `internal-plugins/setting/`.

## Overview

This repo has two main frontend surfaces:

- `src/renderer/` for the main search window and related UI
- `internal-plugins/setting/` for the built-in settings plugin

Both use Vue 3 with `<script setup lang="ts">`, but the setting plugin is the heaviest frontend surface and should drive most style decisions.

## Pre-Development Checklist

Before editing frontend code for this package, read:

1. [Directory Structure](./directory-structure.md)
2. [Component Guidelines](./component-guidelines.md)
3. [Hook Guidelines](./hook-guidelines.md)
4. [State Management](./state-management.md)
5. [Type Safety](./type-safety.md)
6. [Quality Guidelines](./quality-guidelines.md)

## Guides in This Layer

| Guide | Purpose |
|---|---|
| [Directory Structure](./directory-structure.md) | Where views, components, stores, and composables live |
| [Component Guidelines](./component-guidelines.md) | Vue component shape, overlay/detail patterns, and styling |
| [Hook Guidelines](./hook-guidelines.md) | How composables are used for host integrations and UI state |
| [State Management](./state-management.md) | When to use Pinia versus local `ref/computed` state |
| [Type Safety](./type-safety.md) | How local interfaces and shared API types are handled |
| [Quality Guidelines](./quality-guidelines.md) | Review checklist and common UI mistakes |
