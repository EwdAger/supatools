# Plugin README Description URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make uninstalled plugin detail pages read README content from `plugins.json.descriptionURL` when present, while preserving existing installed-plugin behavior and GitHub fallback behavior.

**Architecture:** Keep the existing renderer API unchanged and implement the new behavior inside `PluginsAPI.getRemotePluginReadme`. Extend cached market metadata typing with `descriptionURL`, resolve the remote README URL from cached market data, and rewrite relative README assets against the actual fetched README directory instead of a hard-coded GitHub base.

**Tech Stack:** TypeScript, Electron main-process APIs, Vitest

---

### Task 1: Add the failing README resolution tests

**Files:**
- Create: `tests/main/pluginReadme.test.ts`
- Modify: `src/main/api/renderer/plugins.ts`
- Test: `tests/main/pluginReadme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockHttpGet = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('fs', () => ({
  promises: {
    readFile: mockReadFile,
    rm: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    cp: vi.fn(),
    stat: vi.fn()
  }
}))

vi.mock('../../src/main/api/shared/database', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: vi.fn(),
    clearPluginData: vi.fn()
  }
}))

vi.mock('../../src/main/utils/httpRequest.js', () => ({
  httpGet: mockHttpGet
}))

// ...keep remaining collaborator mocks minimal...

import { PluginsAPI } from '../../src/main/api/renderer/plugins'

describe('plugin readme resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockReturnValue([])
  })

  it('uses descriptionURL from cached market data for uninstalled plugins', async () => {
    mockDbGet.mockImplementation((key: string) => {
      if (key === 'plugin-market-data') {
        return [
          {
            name: 'demo-plugin',
            descriptionURL: 'https://gitlab.example.com/team/demo/-/raw/main/README.md'
          }
        ]
      }
      return []
    })
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: '# Demo\n![img](./assets/demo.png)\n[guide](./docs/guide.md)'
    })

    const api = new PluginsAPI()
    const result = await api.getPluginReadme('demo-plugin')

    expect(mockHttpGet).toHaveBeenCalledWith(
      'https://gitlab.example.com/team/demo/-/raw/main/README.md',
      expect.any(Object)
    )
    expect(result.success).toBe(true)
    expect(result.content).toContain(
      'https://gitlab.example.com/team/demo/-/raw/main/assets/demo.png'
    )
    expect(result.content).toContain(
      'https://gitlab.example.com/team/demo/-/raw/main/docs/guide.md'
    )
  })

  it('falls back to GitHub raw README when descriptionURL is missing', async () => {
    mockDbGet.mockImplementation((key: string) => {
      if (key === 'plugin-market-data') {
        return [{ name: 'demo-plugin' }]
      }
      return []
    })
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: '# Demo'
    })

    const api = new PluginsAPI()
    await api.getPluginReadme('demo-plugin')

    expect(mockHttpGet).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/ZToolsCenter/ZTools-plugins/main/plugins/demo-plugin/README.md',
      expect.any(Object)
    )
  })

  it('keeps installed plugin README loading local-first', async () => {
    mockReadFile.mockResolvedValue('# Local README')

    const api = new PluginsAPI()
    const result = await api.getPluginReadme('/tmp/demo-plugin')

    expect(mockReadFile).toHaveBeenCalled()
    expect(mockHttpGet).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, content: '# Local README' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: FAIL because the current implementation ignores cached `descriptionURL` and rewrites against the hard-coded GitHub base.

- [ ] **Step 3: Write minimal implementation**

```ts
type PluginMarketReadmeRecord = {
  name?: string
  descriptionURL?: string
}

private resolveRemoteReadmeUrl(pluginName: string): string {
  const marketPlugins = databaseAPI.dbGet('plugin-market-data')
  const marketPlugin = Array.isArray(marketPlugins)
    ? (marketPlugins as PluginMarketReadmeRecord[]).find((plugin) => plugin?.name === pluginName)
    : null

  if (marketPlugin?.descriptionURL?.trim()) {
    return marketPlugin.descriptionURL.trim()
  }

  return `https://raw.githubusercontent.com/ZToolsCenter/ZTools-plugins/main/plugins/${pluginName}/README.md`
}
```

```ts
const readmeUrl = this.resolveRemoteReadmeUrl(pluginName)
const readmeBaseUrl = new URL('.', readmeUrl).toString().replace(/\/$/, '')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/main/pluginReadme.test.ts src/main/api/renderer/plugins.ts src/main/api/renderer/pluginMarket.ts
git commit -m "fix: prefer market readme url for plugin details"
```

### Task 2: Align market typing with the new metadata

**Files:**
- Modify: `src/main/api/renderer/pluginMarket.ts`
- Test: `tests/main/pluginReadme.test.ts`

- [ ] **Step 1: Write the failing test**

Use the existing `descriptionURL` test from Task 1 as the failing guard. No additional test is needed if TypeScript accepts the new field and the behavior remains covered.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: FAIL remains attributable to missing runtime support until implementation lands.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PluginMarketPlugin = {
  name: string
  version: string
  title?: string
  description?: string
  descriptionURL?: string
  logo?: string
  platform?: string[]
  downloadUrl?: string
  [key: string]: unknown
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/api/renderer/pluginMarket.ts
git commit -m "chore: type plugin market readme url metadata"
```

### Task 3: Verify the focused regression path

**Files:**
- Modify: `tests/main/pluginReadme.test.ts`
- Test: `tests/main/pluginReadme.test.ts`

- [ ] **Step 1: Write the failing test**

If missing after implementation, add one assertion proving README asset rewriting uses the fetched README directory rather than the old GitHub base:

```ts
expect(result.content).not.toContain(
  'https://raw.githubusercontent.com/ZToolsCenter/ZTools-plugins/main/plugins/demo-plugin/assets/demo.png'
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: FAIL if the implementation still rewrites relative paths against the GitHub base.

- [ ] **Step 3: Write minimal implementation**

```ts
private rewriteRemoteReadmeContent(content: string, readmeUrl: string): string {
  const baseUrl = new URL('.', readmeUrl).toString().replace(/\/$/, '')
  // apply existing markdown/html replacements against baseUrl
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/main/pluginReadme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/main/pluginReadme.test.ts src/main/api/renderer/plugins.ts
git commit -m "test: cover remote readme asset rewriting"
```
