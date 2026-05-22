# Component Guidelines

> How components are built in this project.

## Component Structure

The dominant pattern is:

1. imports
2. local interfaces/types
3. `ref` state
4. `computed`
5. async actions / handlers
6. watchers / lifecycle hooks
7. template
8. scoped styles when needed

Examples:

- Large screen component: `internal-plugins/setting/src/views/PluginsSetting/PluginsSetting.vue`
- Detail overlay component: `internal-plugins/setting/src/components/common/PluginDetail/PluginDetail.vue`

## Common Patterns

- Use `<script setup lang="ts">`.
- Keep screen-level orchestration inside the owning view.
- Use dedicated overlay/detail components instead of stuffing everything into one screen.
- Prefer explicit local interfaces over anonymous object shapes when state is non-trivial.

## Styling Patterns

- Existing UI uses plain scoped CSS and shared CSS variables from the setting plugin's global stylesheet.
- Keep styling close to the component unless it is truly shared theme infrastructure.

## Accessibility and Interaction

- Interactive rows are usually buttons or clickable cards with explicit action buttons for secondary operations.
- Small-window density matters; multi-step flows should become second-level panels instead of stacking everything into one page.

## Common Mistakes

- Letting a single settings view accumulate too many responsibilities without a detail panel split.
- Mixing host-bridge logic directly into small reusable components.
- Adding UI state to global stores when it only matters for one screen instance.
