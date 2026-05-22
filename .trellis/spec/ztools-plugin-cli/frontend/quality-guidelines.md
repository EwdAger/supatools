# Quality Guidelines

> Code quality standards for frontend work.

## Required Patterns

- Wrap host API calls in `try/catch` in views and give user feedback with existing toast helpers.
- Keep list/detail flows consistent with existing overlay and secondary-panel patterns.
- Prefer small pure helper functions for data shaping, especially for filtering and sorting.

Examples:

- Toast-based async handling: `internal-plugins/setting/src/views/RemoteAgentSetting/RemoteAgentSetting.vue`
- List/detail overlay pattern: `internal-plugins/setting/src/views/PluginsSetting/PluginsSetting.vue`
- Search/filter helper composition: `src/renderer/src/stores/commandDataStore.ts`

## Forbidden Patterns

- Do not bury backend/business assumptions directly inside presentation-only components.
- Do not silently swallow failed host calls in settings pages.
- Do not create new visual patterns when an existing card/detail/list pattern already fits.

## Testing Requirements

- Prefer unit tests for pure frontend helpers.
- For views, make the underlying data-shaping logic testable before considering UI-heavy tests.

## Review Checklist

- Does this change preserve the small-window interaction model?
- Is async host interaction surfaced to users with clear success/error feedback?
- Is the state scoped to the smallest reasonable owner?
