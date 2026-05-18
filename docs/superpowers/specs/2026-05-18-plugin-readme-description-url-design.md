# Plugin README Description URL Design

## Goal

Allow plugin market detail pages to load README content from a `descriptionURL` field in `plugins.json` for uninstalled plugins. If `descriptionURL` is not present, preserve the current fallback to the hard-coded GitHub Raw README path. Installed plugins must keep the current behavior unchanged.

## Current Behavior

- The plugin market list is loaded from remote market metadata and cached in `plugin-market-data`.
- Plugin detail rendering uses the shared `PluginDetail` view.
- The detail tab loads README content through `PluginsAPI.getPluginReadme`.
- Installed plugins pass a filesystem path first, so README loading prefers local plugin files.
- Uninstalled plugins pass a plugin name, which currently triggers a hard-coded GitHub Raw URL lookup.

## Requirements

### Functional

1. When an uninstalled plugin detail page requests README content, the main process should first look up the plugin in cached market metadata.
2. If the cached market record contains a non-empty `descriptionURL`, the README request should use that URL.
3. If no `descriptionURL` is available, README loading should fall back to the existing hard-coded GitHub Raw path.
4. Installed plugin behavior must remain unchanged:
   - local README first
   - existing remote fallback second

### Non-Functional

1. The new behavior must not require frontend API changes.
2. Relative image and link rewriting in remote README content must work for both GitHub Raw URLs and arbitrary `descriptionURL` hosts.
3. Missing or failing `descriptionURL` fetches should surface through the existing README error path instead of crashing the detail panel.

## Design

### Market Metadata Extension

Extend the market plugin metadata type to include an optional `descriptionURL?: string` field. This keeps the new behavior aligned with existing market cache usage and avoids introducing a new API contract.

### Remote README Resolution

Keep `PluginsAPI.getPluginReadme` entry behavior unchanged:

- path input -> `getLocalPluginReadme`
- name input -> `getRemotePluginReadme`

Update `getRemotePluginReadme(pluginName)` to:

1. Read `plugin-market-data` from the existing database cache.
2. Find the matching market plugin by `name`.
3. If that record has a non-empty `descriptionURL`, fetch README content from that URL.
4. Otherwise, construct the current GitHub Raw fallback URL.

### Relative Asset Rewriting

The current remote README logic rewrites relative Markdown and HTML paths against a fixed GitHub base directory. That must be generalized.

For remote README responses:

1. Determine the effective README URL used for the fetch.
2. Derive a directory base URL from that README URL.
3. Rewrite relative image and link references against that derived directory base.

This preserves current GitHub behavior while supporting GitLab or self-hosted README URLs without special cases.

### Error Handling

- If `descriptionURL` is absent, use the existing fallback behavior.
- If remote fetch fails, return the existing `{ success: false, error }` shape.
- No UI changes are required because the existing detail tab already renders README load failures.

## Testing

Add focused Vitest coverage for `PluginsAPI.getPluginReadme`:

1. Uninstalled plugin with cached `descriptionURL` fetches that URL instead of GitHub Raw.
2. Uninstalled plugin without `descriptionURL` still uses GitHub Raw fallback.
3. Installed plugin path input still reads local README without consulting market metadata.
4. Remote README relative assets are rewritten against the actual fetched README directory when `descriptionURL` is used.
