# Remote Agent Plugin Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plugin `tags` metadata plus a new remote Linux agent onboarding and manual plugin sync flow in the settings plugin.

**Architecture:** Normalize plugin metadata once at install/load time, then add a dedicated `src/main/core/remoteAgent/` domain for machine documents, onboarding HTTP service, remote HTTP client, and deployment orchestration. Expose that domain to the built-in setting plugin through `internal:` IPC and extend the setting plugin with a new `Remote Agent` page driven by pure filtering utilities plus explicit sync actions.

**Tech Stack:** Electron main process, TypeScript, Vue 3 setting plugin, LMDB-backed app storage, Vitest

---

### Task 1: Normalize Plugin `platform` / `tags` Metadata

**Files:**
- Create: `src/shared/pluginMetadata.ts`
- Modify: `src/main/api/renderer/pluginInstaller.ts`
- Modify: `src/main/core/internalPluginLoader.ts`
- Modify: `src/main/api/renderer/pluginDevelopmentRegistry.ts`
- Test: `tests/main/pluginMetadata.test.ts`
- Test: `tests/main/pluginDevelopmentRegistry.test.ts`

- [ ] **Step 1: Write the failing metadata normalization tests**

```ts
// tests/main/pluginMetadata.test.ts
import { describe, expect, it } from 'vitest'
import { normalizePluginMetadata } from '../../src/shared/pluginMetadata'

describe('pluginMetadata', () => {
  it('normalizes duplicated platform and tags entries', () => {
    expect(
      normalizePluginMetadata({
        platform: ['linux', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    ).toEqual({
      platform: ['linux', 'win32'],
      tags: ['scp', 'hci']
    })
  })

  it('returns empty arrays when manifest fields are absent', () => {
    expect(normalizePluginMetadata({})).toEqual({
      platform: [],
      tags: []
    })
  })
})
```

```ts
// tests/main/pluginDevelopmentRegistry.test.ts
it('builds the installed snapshot with normalized platform and tags', () => {
  const installed = buildInstalledDevelopmentPlugin('/workspace/demo', {
    name: 'demo',
    title: 'Demo',
    version: '1.0.0',
    features: [{ code: 'ui.demo', cmds: ['Demo'] }],
    platform: ['linux', 'linux'],
    tags: ['scp', 'HCI'],
    development: { main: 'http://localhost:8686/' }
  })

  expect(installed.platform).toEqual(['linux'])
  expect(installed.tags).toEqual(['scp', 'hci'])
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `pnpm vitest run tests/main/pluginMetadata.test.ts tests/main/pluginDevelopmentRegistry.test.ts`

Expected: FAIL with errors such as `Cannot find module '../../src/shared/pluginMetadata'` and missing `platform` / `tags` fields on the installed development snapshot.

- [ ] **Step 3: Implement shared metadata normalization and wire it into every plugin persistence path**

```ts
// src/shared/pluginMetadata.ts
export type NormalizedPluginMetadata = {
  platform: string[]
  tags: string[]
}

function normalizeStringArray(value: unknown, lowerCase = false): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') continue
    const normalized = (lowerCase ? item.toLowerCase() : item).trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function normalizePluginMetadata(manifest: {
  platform?: unknown
  tags?: unknown
}): NormalizedPluginMetadata {
  return {
    platform: normalizeStringArray(manifest.platform, true),
    tags: normalizeStringArray(manifest.tags, true)
  }
}
```

```ts
// src/main/api/renderer/pluginInstaller.ts
const { platform, tags } = normalizePluginMetadata(config)

const pluginInfo = {
  name: config.name,
  title: config.title,
  version: config.version,
  description: config.description || '',
  author: config.author || '',
  homepage: config.homepage || '',
  logo: config.logo ? pathToFileURL(path.join(pluginPath, config.logo)).href : '',
  main: config.main,
  preload: config.preload,
  features: config.features,
  platform,
  tags,
  path: pluginPath,
  isDevelopment: false,
  installedAt: new Date().toISOString(),
  ...extra
}
```

```ts
// src/main/core/internalPluginLoader.ts
const { platform, tags } = normalizePluginMetadata(pluginConfig)

const pluginInfo = {
  name: pluginConfig.name,
  title: pluginConfig.title,
  version: pluginConfig.version,
  description: pluginConfig.description || '',
  logo: logoPath ? pathToFileURL(logoPath).href : '',
  path: effectivePluginPath,
  features: pluginConfig.features || [],
  platform,
  tags,
  isDevelopment: isDev,
  main: mainPath
}
```

```ts
// src/main/api/renderer/pluginDevelopmentRegistry.ts
const { platform, tags } = normalizePluginMetadata(pluginConfig)

return {
  name: effectiveName,
  title: pluginConfig.title,
  version: pluginConfig.version,
  description: pluginConfig.description || '',
  author: pluginConfig.author || '',
  homepage: pluginConfig.homepage || '',
  logo: pluginConfig.logo || '',
  main: pluginConfig.development?.main,
  preload: pluginConfig.preload,
  features: Array.isArray(pluginConfig.features) ? pluginConfig.features : [],
  platform,
  tags,
  path: normalizedPath,
  isDevelopment: true,
  installedAt: nowIso()
}
```

- [ ] **Step 4: Run the metadata regression tests**

Run: `pnpm vitest run tests/main/pluginMetadata.test.ts tests/main/pluginDevelopmentRegistry.test.ts`

Expected: PASS with the new shared normalizer and the updated development-plugin snapshot fields.

- [ ] **Step 5: Commit the metadata foundation**

```bash
git add src/shared/pluginMetadata.ts src/main/api/renderer/pluginInstaller.ts src/main/core/internalPluginLoader.ts src/main/api/renderer/pluginDevelopmentRegistry.ts tests/main/pluginMetadata.test.ts tests/main/pluginDevelopmentRegistry.test.ts
git commit -m "feat: normalize plugin platform and tags metadata"
```

### Task 2: Add Remote Agent Documents and Onboarding Service Core

**Files:**
- Create: `src/shared/remoteAgent.ts`
- Create: `src/main/core/remoteAgent/localAddressDiscovery.ts`
- Create: `src/main/core/remoteAgent/store.ts`
- Create: `src/main/core/remoteAgent/onboardingService.ts`
- Test: `tests/main/remoteAgentStore.test.ts`

- [ ] **Step 1: Write the failing remote-agent state tests**

```ts
// tests/main/remoteAgentStore.test.ts
import { describe, expect, it } from 'vitest'
import {
  createEmptyRemoteAgentsDoc,
  createPendingRemoteAgent,
  markRemoteAgentOnline
} from '../../src/main/core/remoteAgent/store'

describe('remoteAgent store', () => {
  it('creates a pending remote agent with a token and selected local address', () => {
    const state = createPendingRemoteAgent(createEmptyRemoteAgentsDoc(), {
      id: 'agent-1',
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_list', tags: ['scp', 'hci'] },
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })

    expect(state.items[0].status).toBe('pending')
    expect(state.items[0].selectedLocalAddress).toBe('192.168.1.23')
    expect(state.items[0].onboardingToken).toBe('token-1')
  })

  it('marks a registered machine online and clears onboarding credentials', () => {
    const pending = createPendingRemoteAgent(createEmptyRemoteAgentsDoc(), {
      id: 'agent-1',
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_all' },
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })

    const online = markRemoteAgentOnline(pending, {
      id: 'agent-1',
      agentBaseUrl: 'http://10.0.0.5:8123',
      agentVersion: '0.1.0',
      lastSeenAt: '2026-05-07T08:03:00.000Z'
    })

    expect(online.items[0].status).toBe('online')
    expect(online.items[0].onboardingToken).toBeUndefined()
    expect(online.items[0].agentBaseUrl).toBe('http://10.0.0.5:8123')
  })
})
```

- [ ] **Step 2: Run the store tests to confirm the new domain is missing**

Run: `pnpm vitest run tests/main/remoteAgentStore.test.ts`

Expected: FAIL with `Cannot find module '../../src/main/core/remoteAgent/store'`.

- [ ] **Step 3: Implement the shared remote-agent types, LMDB document reducers, LAN address discovery, and onboarding script responder**

```ts
// src/shared/remoteAgent.ts
export const REMOTE_AGENTS_DB_KEY = 'settings-remote-agents'
export const REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY = 'settings-remote-agent-plugin-configs'
export const REMOTE_AGENT_SYNC_JOBS_DB_KEY = 'settings-remote-agent-sync-jobs'

export type RemoteAgentStatus = 'pending' | 'onboarding' | 'online' | 'offline' | 'error'

export type RemoteAgentTagPolicy =
  | { mode: 'allow_all' }
  | { mode: 'allow_list'; tags: string[] }

export interface RemoteAgentRecord {
  id: string
  name: string
  platform: 'linux'
  tagPolicy: RemoteAgentTagPolicy
  status: RemoteAgentStatus
  selectedLocalAddress: string
  onboardingToken?: string
  onboardingExpiresAt?: string
  agentBaseUrl?: string
  agentVersion?: string
  lastSeenAt?: string
  lastError?: string
}

export interface RemoteAgentPluginConfigRecord {
  machineId: string
  pluginName: string
  config: Record<string, unknown>
  updatedAt: string
}

export interface RemoteAgentSyncJobRecord {
  machineId: string
  pluginName: string
  action: 'install' | 'upgrade' | 'configure' | 'restart' | 'uninstall'
  status: 'success' | 'error'
  message: string
  startedAt: string
  finishedAt: string
}
```

```ts
// src/main/core/remoteAgent/localAddressDiscovery.ts
import os from 'os'

export function listLanIpv4Addresses(snapshot = os.networkInterfaces()): string[] {
  const result = new Set<string>()

  for (const addresses of Object.values(snapshot)) {
    for (const entry of addresses || []) {
      if (!entry) continue
      if (entry.family !== 'IPv4') continue
      if (entry.internal) continue
      result.add(entry.address)
    }
  }

  return [...result].sort()
}
```

```ts
// src/main/core/remoteAgent/store.ts
import type { RemoteAgentRecord } from '../../../shared/remoteAgent'

export function createEmptyRemoteAgentsDoc(): { items: RemoteAgentRecord[] } {
  return { items: [] }
}

export function createPendingRemoteAgent(
  doc: { items: RemoteAgentRecord[] },
  input: RemoteAgentRecord & { onboardingToken: string; onboardingExpiresAt: string }
): { items: RemoteAgentRecord[] } {
  const others = doc.items.filter((item) => item.id !== input.id)
  return { items: [...others, { ...input, status: 'pending' }] }
}

export function markRemoteAgentOnline(
  doc: { items: RemoteAgentRecord[] },
  input: {
    id: string
    agentBaseUrl: string
    agentVersion: string
    lastSeenAt: string
  }
): { items: RemoteAgentRecord[] } {
  return {
    items: doc.items.map((item) =>
      item.id !== input.id
        ? item
        : {
            ...item,
            status: 'online',
            onboardingToken: undefined,
            onboardingExpiresAt: undefined,
            agentBaseUrl: input.agentBaseUrl,
            agentVersion: input.agentVersion,
            lastSeenAt: input.lastSeenAt,
            lastError: undefined
          }
    )
  }
}
```

```ts
// src/main/core/remoteAgent/onboardingService.ts
private renderInstallScript(record: RemoteAgentRecord): string {
  const installUrl = `http://${record.selectedLocalAddress}:${this.port}/agent/register`
  return [
    '#!/bin/sh',
    'set -eu',
    `AGENT_MACHINE_ID="${record.id}"`,
    `AGENT_TOKEN="${record.onboardingToken}"`,
    `AGENT_REGISTER_URL="${installUrl}"`,
    'echo "Installing ZTools Linux agent..."',
    'mkdir -p "$HOME/.ztools-agent"',
    'cat > "$HOME/.ztools-agent/config.env" <<EOF',
    'AGENT_MACHINE_ID=$AGENT_MACHINE_ID',
    'AGENT_TOKEN=$AGENT_TOKEN',
    'AGENT_REGISTER_URL=$AGENT_REGISTER_URL',
    'EOF'
  ].join('\n')
}
```

- [ ] **Step 4: Run the remote-agent core tests**

Run: `pnpm vitest run tests/main/remoteAgentStore.test.ts`

Expected: PASS with pending-machine creation and online registration state transitions covered.

- [ ] **Step 5: Commit the remote-agent domain core**

```bash
git add src/shared/remoteAgent.ts src/main/core/remoteAgent/localAddressDiscovery.ts src/main/core/remoteAgent/store.ts src/main/core/remoteAgent/onboardingService.ts tests/main/remoteAgentStore.test.ts
git commit -m "feat: add remote agent onboarding state core"
```

### Task 3: Expose Remote Agent Control Through Internal IPC and Plugin Preload

**Files:**
- Create: `src/main/core/remoteAgent/manager.ts`
- Modify: `src/main/api/index.ts`
- Modify: `src/main/api/plugin/internal.ts`
- Modify: `resources/preload.js`
- Modify: `internal-plugins/setting/src/env.d.ts`
- Test: `tests/main/pluginPreloadInternalApi.test.ts`

- [ ] **Step 1: Extend the preload bridge tests for the new internal remote-agent methods**

```ts
// tests/main/pluginPreloadInternalApi.test.ts
it('exposes createRemoteAgent for internal plugin runtimes', async () => {
  require(preloadPath)

  const internalApi = (globalThis as any).window.ztools?.internal

  expect(internalApi?.createRemoteAgent).toBeTypeOf('function')

  await internalApi.createRemoteAgent({
    name: 'Workshop Linux',
    platform: 'linux',
    selectedLocalAddress: '192.168.1.23',
    tagPolicy: { mode: 'allow_all' }
  })

  expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agent-create', {
    name: 'Workshop Linux',
    platform: 'linux',
    selectedLocalAddress: '192.168.1.23',
    tagPolicy: { mode: 'allow_all' }
  })
})

it('exposes listRemoteAgents for internal plugin runtimes', async () => {
  require(preloadPath)

  const internalApi = (globalThis as any).window.ztools?.internal

  expect(internalApi?.listRemoteAgents).toBeTypeOf('function')

  await internalApi.listRemoteAgents()

  expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agents-list')
})
```

- [ ] **Step 2: Run the preload bridge test to verify the API gap**

Run: `pnpm vitest run tests/main/pluginPreloadInternalApi.test.ts`

Expected: FAIL because `window.ztools.internal.createRemoteAgent` and `window.ztools.internal.listRemoteAgents` are not yet defined.

- [ ] **Step 3: Add the singleton manager, internal IPC handlers, plugin preload bridge methods, and TypeScript declarations**

```ts
// src/main/core/remoteAgent/manager.ts
export class RemoteAgentManager {
  public init(): void {
    this.onboardingService = new OnboardingService({
      findByToken: (token) => this.findByToken(token),
      completeRegistration: (payload) => this.completeRegistration(payload)
    })
  }

  public listRemoteAgents(): Promise<RemoteAgentRecord[]> {
    return Promise.resolve(this.readAgentsDoc().items)
  }

  public createRemoteAgent(input: {
    name: string
    platform: 'linux'
    selectedLocalAddress: string
    tagPolicy: RemoteAgentTagPolicy
  }): Promise<{ success: boolean; record: RemoteAgentRecord; installCommand: string }> {
    return this.createPendingAgent(input)
  }

  public saveRemoteAgentPluginConfig(input: {
    machineId: string
    pluginName: string
    config: Record<string, unknown>
  }): Promise<{ success: boolean }> {
    return this.writePluginConfig(input)
  }

  public listRemoteAgentSyncJobs(machineId: string): Promise<RemoteAgentSyncJobRecord[]> {
    return Promise.resolve(this.readSyncJobs(machineId))
  }
}
```

```ts
// src/main/api/plugin/internal.ts
ipcMain.handle('internal:remote-agents-list', async (event) => {
  if (!requireInternalPlugin(this.pluginManager, event)) {
    throw new PermissionDeniedError('internal:remote-agents-list')
  }
  return await remoteAgentManager.listRemoteAgents()
})

ipcMain.handle('internal:remote-agent-create', async (event, payload) => {
  if (!requireInternalPlugin(this.pluginManager, event)) {
    throw new PermissionDeniedError('internal:remote-agent-create')
  }
  return await remoteAgentManager.createRemoteAgent(payload)
})

ipcMain.handle('internal:remote-agent-save-plugin-config', async (event, payload) => {
  if (!requireInternalPlugin(this.pluginManager, event)) {
    throw new PermissionDeniedError('internal:remote-agent-save-plugin-config')
  }
  return await remoteAgentManager.saveRemoteAgentPluginConfig(payload)
})

ipcMain.handle('internal:remote-agent-sync', async (event, machineId: string) => {
  if (!requireInternalPlugin(this.pluginManager, event)) {
    throw new PermissionDeniedError('internal:remote-agent-sync')
  }
  return await remoteAgentManager.syncRemoteAgent(machineId)
})

ipcMain.handle('internal:remote-agent-sync-jobs', async (event, machineId: string) => {
  if (!requireInternalPlugin(this.pluginManager, event)) {
    throw new PermissionDeniedError('internal:remote-agent-sync-jobs')
  }
  return await remoteAgentManager.listRemoteAgentSyncJobs(machineId)
})
```

```js
// resources/preload.js
listRemoteAgents: async () =>
  await electron.ipcRenderer.invoke('internal:remote-agents-list'),
createRemoteAgent: async (payload) =>
  await electron.ipcRenderer.invoke('internal:remote-agent-create', payload),
listRemoteAgentLocalAddresses: async () =>
  await electron.ipcRenderer.invoke('internal:remote-agent-local-addresses'),
regenerateRemoteAgentInstallCommand: async (machineId, selectedLocalAddress) =>
  await electron.ipcRenderer.invoke(
    'internal:remote-agent-regenerate-install-command',
    machineId,
    selectedLocalAddress
  ),
saveRemoteAgentPluginConfig: async (payload) =>
  await electron.ipcRenderer.invoke('internal:remote-agent-save-plugin-config', payload),
syncRemoteAgent: async (machineId) =>
  await electron.ipcRenderer.invoke('internal:remote-agent-sync', machineId),
listRemoteAgentSyncJobs: async (machineId) =>
  await electron.ipcRenderer.invoke('internal:remote-agent-sync-jobs', machineId),
```

```ts
// internal-plugins/setting/src/env.d.ts
listRemoteAgents: () => Promise<any[]>
listRemoteAgentLocalAddresses: () => Promise<string[]>
createRemoteAgent: (payload: {
  name: string
  platform: 'linux'
  selectedLocalAddress: string
  tagPolicy: { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }
}) => Promise<{
  success: boolean
  record?: any
  installCommand?: string
  error?: string
}>
regenerateRemoteAgentInstallCommand: (
  machineId: string,
  selectedLocalAddress: string
) => Promise<{ success: boolean; installCommand?: string; error?: string }>
saveRemoteAgentPluginConfig: (payload: {
  machineId: string
  pluginName: string
  config: Record<string, unknown>
}) => Promise<{ success: boolean; error?: string }>
syncRemoteAgent: (
  machineId: string
) => Promise<{ success: boolean; summary?: any; error?: string }>
listRemoteAgentSyncJobs: (machineId: string) => Promise<any[]>
```

```ts
// src/main/api/index.ts
remoteAgentManager.init()
```

- [ ] **Step 4: Re-run the preload bridge tests**

Run: `pnpm vitest run tests/main/pluginPreloadInternalApi.test.ts`

Expected: PASS with the new `internal:` remote-agent bridge methods routed through `resources/preload.js`.

- [ ] **Step 5: Commit the IPC and preload bridge**

```bash
git add src/main/core/remoteAgent/manager.ts src/main/api/index.ts src/main/api/plugin/internal.ts resources/preload.js internal-plugins/setting/src/env.d.ts tests/main/pluginPreloadInternalApi.test.ts
git commit -m "feat: expose remote agent controls to internal plugins"
```

### Task 4: Implement Remote Agent HTTP Client and Manual Sync Orchestration

**Files:**
- Create: `src/main/core/remoteAgent/client.ts`
- Create: `src/main/core/remoteAgent/deployment.ts`
- Modify: `src/main/core/remoteAgent/manager.ts`
- Test: `tests/main/remoteAgentDeployment.test.ts`

- [ ] **Step 1: Write the failing deployable-plugin and sync-plan tests**

```ts
// tests/main/remoteAgentDeployment.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildDeployablePluginList,
  buildRemoteAgentSyncPlan
} from '../../src/main/core/remoteAgent/deployment'

describe('remoteAgent deployment', () => {
  it('filters plugins by linux platform and allow_list tags', () => {
    const plugins = [
      { name: 'scp-tool', version: '1.0.0', platform: ['linux'], tags: ['scp'] },
      { name: 'mac-only', version: '1.0.0', platform: ['darwin'], tags: ['scp'] },
      { name: 'other-tag', version: '1.0.0', platform: ['linux'], tags: ['ocr'] }
    ]

    const deployable = buildDeployablePluginList(plugins, {
      platform: 'linux',
      tagPolicy: { mode: 'allow_list', tags: ['scp'] }
    })

    expect(deployable.map((plugin) => plugin.name)).toEqual(['scp-tool'])
  })

  it('marks version drift and missing plugins in the sync plan', () => {
    const plan = buildRemoteAgentSyncPlan(
      [{ name: 'scp-tool', version: '1.0.0', platform: ['linux'], tags: ['scp'] }],
      [{ name: 'scp-tool', version: '0.9.0' }, { name: 'legacy-tool', version: '0.1.0' }],
      { uninstallExtraneous: true }
    )

    expect(plan.install).toEqual([])
    expect(plan.upgrade.map((plugin) => plugin.name)).toEqual(['scp-tool'])
    expect(plan.uninstall.map((plugin) => plugin.name)).toEqual(['legacy-tool'])
  })
})
```

- [ ] **Step 2: Run the orchestration tests before implementation**

Run: `pnpm vitest run tests/main/remoteAgentDeployment.test.ts`

Expected: FAIL with `Cannot find module '../../src/main/core/remoteAgent/deployment'`.

- [ ] **Step 3: Add the deployable-plugin filter, sync-plan builder, HTTP client, and manager sync entrypoint**

```ts
// src/main/core/remoteAgent/deployment.ts
import type { RemoteAgentTagPolicy } from '../../../shared/remoteAgent'

function matchesTagPolicy(tags: string[], policy: RemoteAgentTagPolicy): boolean {
  if (policy.mode === 'allow_all') return true
  return tags.some((tag) => policy.tags.includes(tag))
}

export function buildDeployablePluginList(
  plugins: Array<{ name: string; version: string; platform?: string[]; tags?: string[] }>,
  machine: { platform: 'linux'; tagPolicy: RemoteAgentTagPolicy }
) {
  return plugins.filter((plugin) => {
    const platform = plugin.platform || []
    const tags = plugin.tags || []
    return platform.includes(machine.platform) && matchesTagPolicy(tags, machine.tagPolicy)
  })
}

export function buildRemoteAgentSyncPlan(
  localPlugins: Array<{ name: string; version: string }>,
  remotePlugins: Array<{ name: string; version: string }>,
  options: { uninstallExtraneous: boolean }
) {
  const remoteByName = new Map(remotePlugins.map((plugin) => [plugin.name, plugin]))
  const localNames = new Set(localPlugins.map((plugin) => plugin.name))

  return {
    install: localPlugins.filter((plugin) => !remoteByName.has(plugin.name)),
    upgrade: localPlugins.filter((plugin) => remoteByName.get(plugin.name)?.version !== plugin.version),
    uninstall: options.uninstallExtraneous
      ? remotePlugins.filter((plugin) => !localNames.has(plugin.name))
      : []
  }
}
```

```ts
// src/main/core/remoteAgent/client.ts
import { httpGet, httpPost } from '../../utils/httpRequest'

export class RemoteAgentClient {
  constructor(private readonly baseUrl: string) {}

  public async getInfo(): Promise<any> {
    return (await httpGet(`${this.baseUrl}/api/agent/info`)).data
  }

  public async listPlugins(): Promise<any[]> {
    return (await httpGet(`${this.baseUrl}/api/plugins`)).data as any[]
  }

  public async installPlugin(payload: Record<string, unknown>): Promise<any> {
    return (await httpPost(`${this.baseUrl}/api/plugins/install`, payload)).data
  }

  public async configurePlugin(payload: Record<string, unknown>): Promise<any> {
    return (await httpPost(`${this.baseUrl}/api/plugins/configure`, payload)).data
  }

  public async restartPlugin(payload: Record<string, unknown>): Promise<any> {
    return (await httpPost(`${this.baseUrl}/api/plugins/restart`, payload)).data
  }
}
```

```ts
// src/main/core/remoteAgent/manager.ts
public async syncRemoteAgent(machineId: string): Promise<{ success: boolean; summary?: any; error?: string }> {
  const machine = this.requireMachine(machineId)
  const allPlugins = await pluginsAPI.getPlugins()
  const deployable = buildDeployablePluginList(allPlugins, machine)
  const client = new RemoteAgentClient(machine.agentBaseUrl!)
  const remotePlugins = await client.listPlugins()
  const pluginConfigs = this.readPluginConfigs(machine.id)
  const plan = buildRemoteAgentSyncPlan(
    deployable.map((plugin) => ({ name: plugin.name, version: plugin.version })),
    remotePlugins,
    { uninstallExtraneous: true }
  )

  for (const plugin of plan.install) {
    await client.installPlugin({ name: plugin.name, version: plugin.version })
  }

  for (const plugin of deployable) {
    const savedConfig = pluginConfigs.find((item) => item.pluginName === plugin.name)
    if (!savedConfig) continue
    await client.configurePlugin({
      pluginName: plugin.name,
      config: savedConfig.config
    })
    await client.restartPlugin({ pluginName: plugin.name })
  }

  return { success: true, summary: plan }
}
```

- [ ] **Step 4: Run the remote-agent deployment tests**

Run: `pnpm vitest run tests/main/remoteAgentDeployment.test.ts`

Expected: PASS with linux-only filtering, allow-list tag matching, and sync-plan diffing covered.

- [ ] **Step 5: Commit the deployment orchestration**

```bash
git add src/main/core/remoteAgent/client.ts src/main/core/remoteAgent/deployment.ts src/main/core/remoteAgent/manager.ts tests/main/remoteAgentDeployment.test.ts
git commit -m "feat: add remote agent manual sync orchestration"
```

### Task 5: Add the Setting Plugin Route and Remote Agent Management UI

**Files:**
- Create: `internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils.ts`
- Create: `internal-plugins/setting/src/views/RemoteAgentSetting/RemoteAgentSetting.vue`
- Modify: `internal-plugins/setting/src/router/router.ts`
- Modify: `internal-plugins/setting/public/plugin.json`
- Test: `tests/renderer/remoteAgentUtils.test.ts`

- [ ] **Step 1: Write the failing renderer utility tests for deployable rows**

```ts
// tests/renderer/remoteAgentUtils.test.ts
import { describe, expect, it } from 'vitest'
import { buildDeployablePluginRows } from '../../internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils'

describe('remoteAgentUtils', () => {
  it('marks plugins outside platform or tag policy as excluded', () => {
    const rows = buildDeployablePluginRows(
      [
        { name: 'scp-tool', version: '1.0.0', platform: ['linux'], tags: ['scp'] },
        { name: 'mac-only', version: '1.0.0', platform: ['darwin'], tags: ['scp'] }
      ],
      {
        platform: 'linux',
        tagPolicy: { mode: 'allow_list', tags: ['scp'] }
      }
    )

    expect(rows.find((row) => row.name === 'scp-tool')?.excluded).toBe(false)
    expect(rows.find((row) => row.name === 'mac-only')?.excludedReason).toBe('platform')
  })
})
```

- [ ] **Step 2: Run the renderer test to confirm the page utilities do not exist yet**

Run: `pnpm vitest run tests/renderer/remoteAgentUtils.test.ts`

Expected: FAIL with `Cannot find module '../../internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils'`.

- [ ] **Step 3: Add the route, plugin feature entry, filtering utility, and remote-agent page**

```ts
// internal-plugins/setting/src/router/router.ts
{
  path: '/remoteAgents',
  name: 'RemoteAgents',
  component: () => import('@/views/RemoteAgentSetting/RemoteAgentSetting.vue'),
  meta: {
    menu: {
      label: '远程 Agent',
      icon: 'i-z-monitor'
    }
  }
}
```

```json
// internal-plugins/setting/public/plugin.json
{
  "code": "ui.router?router=RemoteAgents",
  "explain": "远程 Agent",
  "icon": "logo.png",
  "cmds": ["远程 Agent"]
}
```

```ts
// internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils.ts
export function buildDeployablePluginRows(
  plugins: Array<{ name: string; version: string; platform?: string[]; tags?: string[] }>,
  machine: {
    platform: 'linux'
    tagPolicy: { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }
  }
) {
  return plugins.map((plugin) => {
    const platformOk = (plugin.platform || []).includes(machine.platform)
    const tagOk =
      machine.tagPolicy.mode === 'allow_all'
        ? true
        : (plugin.tags || []).some((tag) => machine.tagPolicy.tags.includes(tag))

    return {
      ...plugin,
      excluded: !(platformOk && tagOk),
      excludedReason: !platformOk ? 'platform' : !tagOk ? 'tag' : undefined
    }
  })
}
```

```vue
<!-- internal-plugins/setting/src/views/RemoteAgentSetting/RemoteAgentSetting.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/components'
import { buildDeployablePluginRows } from './remoteAgentUtils'

const { success, error } = useToast()
const agents = ref<any[]>([])
const plugins = ref<any[]>([])
const localAddresses = ref<string[]>([])
const selectedAgentId = ref('')
const installCommand = ref('')
const currentPluginConfig = ref('{}')
const syncJobs = ref<any[]>([])

const selectedAgent = computed(() =>
  agents.value.find((agent) => agent.id === selectedAgentId.value) || null
)

const deployableRows = computed(() =>
  selectedAgent.value ? buildDeployablePluginRows(plugins.value, selectedAgent.value) : []
)

async function loadPage(): Promise<void> {
  const [agentList, installedPlugins, addresses] = await Promise.all([
    window.ztools.internal.listRemoteAgents(),
    window.ztools.internal.getPlugins(),
    window.ztools.internal.listRemoteAgentLocalAddresses()
  ])
  agents.value = agentList
  plugins.value = installedPlugins
  localAddresses.value = addresses
}

async function loadSyncJobs(): Promise<void> {
  if (!selectedAgent.value) return
  syncJobs.value = await window.ztools.internal.listRemoteAgentSyncJobs(selectedAgent.value.id)
}

async function createAgent(payload: {
  name: string
  selectedLocalAddress: string
  tagPolicy: { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }
}): Promise<void> {
  const result = await window.ztools.internal.createRemoteAgent({
    ...payload,
    platform: 'linux'
  })
  if (!result.success) {
    error(result.error || '创建远程 Agent 失败')
    return
  }
  installCommand.value = result.installCommand || ''
  await loadPage()
  success('安装命令已生成')
}

async function savePluginConfig(pluginName: string): Promise<void> {
  if (!selectedAgent.value) return
  const config = JSON.parse(currentPluginConfig.value)
  const result = await window.ztools.internal.saveRemoteAgentPluginConfig({
    machineId: selectedAgent.value.id,
    pluginName,
    config
  })
  if (!result.success) {
    error(result.error || '保存插件配置失败')
    return
  }
  success('运行前配置已保存')
}

async function syncSelectedAgent(): Promise<void> {
  if (!selectedAgent.value) return
  const result = await window.ztools.internal.syncRemoteAgent(selectedAgent.value.id)
  if (!result.success) {
    error(result.error || '远程 Agent 同步失败')
    return
  }
  await loadSyncJobs()
  success('远程 Agent 同步完成')
}

onMounted(() => {
  void loadPage()
})
</script>
```

- [ ] **Step 4: Run the renderer utility test and the setting-plugin build**

Run: `pnpm vitest run tests/renderer/remoteAgentUtils.test.ts && pnpm build:setting`

Expected: PASS for the utility test and a successful setting-plugin build with the new `RemoteAgents` route and page.

- [ ] **Step 5: Commit the settings UI**

```bash
git add internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils.ts internal-plugins/setting/src/views/RemoteAgentSetting/RemoteAgentSetting.vue internal-plugins/setting/src/router/router.ts internal-plugins/setting/public/plugin.json tests/renderer/remoteAgentUtils.test.ts
git commit -m "feat: add remote agent settings page"
```

### Task 6: Run the Full Regression Sweep

**Files:**
- Test: `tests/main/pluginMetadata.test.ts`
- Test: `tests/main/pluginDevelopmentRegistry.test.ts`
- Test: `tests/main/remoteAgentStore.test.ts`
- Test: `tests/main/remoteAgentDeployment.test.ts`
- Test: `tests/main/pluginPreloadInternalApi.test.ts`
- Test: `tests/renderer/remoteAgentUtils.test.ts`

- [ ] **Step 1: Run the focused remote-agent and metadata suites together**

Run: `pnpm vitest run tests/main/pluginMetadata.test.ts tests/main/pluginDevelopmentRegistry.test.ts tests/main/remoteAgentStore.test.ts tests/main/remoteAgentDeployment.test.ts tests/main/pluginPreloadInternalApi.test.ts tests/renderer/remoteAgentUtils.test.ts`

Expected: PASS across the new metadata, onboarding, IPC bridge, deployment, and renderer utility coverage.

- [ ] **Step 2: Run the repository type checks**

Run: `pnpm typecheck`

Expected: PASS with both `typecheck:node` and `typecheck:web` succeeding after the new remote-agent types and setting-page declarations.

- [ ] **Step 3: Run the full project test suite**

Run: `pnpm test`

Expected: PASS with the newly added remote-agent tests integrated into the existing Vitest suite.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: PASS after the main-process remote-agent code and the built-in setting plugin compile together.

- [ ] **Step 5: Commit the final verified implementation**

```bash
git add src/shared/pluginMetadata.ts src/shared/remoteAgent.ts src/main/core/remoteAgent src/main/api/index.ts src/main/api/plugin/internal.ts src/main/api/renderer/pluginInstaller.ts src/main/core/internalPluginLoader.ts src/main/api/renderer/pluginDevelopmentRegistry.ts resources/preload.js internal-plugins/setting/src/router/router.ts internal-plugins/setting/public/plugin.json internal-plugins/setting/src/views/RemoteAgentSetting internal-plugins/setting/src/env.d.ts tests/main/pluginMetadata.test.ts tests/main/pluginDevelopmentRegistry.test.ts tests/main/remoteAgentStore.test.ts tests/main/remoteAgentDeployment.test.ts tests/main/pluginPreloadInternalApi.test.ts tests/renderer/remoteAgentUtils.test.ts
git commit -m "feat: add remote agent plugin sync"
```
