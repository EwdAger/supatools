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
