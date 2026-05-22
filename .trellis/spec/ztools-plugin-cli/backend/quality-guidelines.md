# Quality Guidelines

> Code quality standards for backend development.

## Required Patterns

- Keep pure normalization and decision logic exportable and testable.
- Keep renderer/plugin-facing orchestration in API modules, not mixed into views or preload glue.
- Normalize data before persistence when the repo already does so for adjacent fields.
- Prefer extending existing modules over creating parallel abstractions.

Examples:

- Pure search/matching helpers split out for testing: `src/main/api/renderer/commandMatchers.ts`
- Deployable plugin filtering as a pure function: `src/main/core/remoteAgent/deployment.ts`
- Registry mutation helpers in a pure module: `src/main/api/renderer/pluginDevelopmentRegistry.ts`

## Forbidden Patterns

- Do not put business logic directly into IPC registration lambdas when it can be extracted.
- Do not duplicate normalization rules across installer/dev/internal plugin loading paths.
- Do not add stateful globals when an existing manager singleton already owns the concern.

## Testing Requirements

- Add unit tests for pure decision/normalization logic.
- Prefer testing small builders, filters, and state transitions before wiring them into Electron.
- Use targeted tests under `tests/main/**` for backend helpers and APIs.

## Code Review Checklist

- Is this logic in the right capability module?
- Is persistence using existing namespace rules?
- Are failures converted into stable API results?
- Can the new logic be tested without launching Electron UI?
