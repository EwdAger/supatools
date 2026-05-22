import { describe, expect, it } from 'vitest'
import {
  buildDeployablePluginList,
  getRemoteDistributionEligibility,
  buildRemoteAgentSyncPlan
} from '../../src/main/core/remoteAgent/deployment'

describe('remoteAgent deployment', () => {
  it('filters plugins by linux platform and allow_list tags', () => {
    const plugins = [
      {
        name: 'scp-tool',
        version: '1.0.0',
        platform: ['linux'],
        tags: ['scp'],
        remoteSync: true,
        runtimeModel: 'service',
        remote: { entry: 'remote/index.js', actions: {} }
      },
      {
        name: 'mac-only',
        version: '1.0.0',
        platform: ['darwin'],
        tags: ['scp'],
        remoteSync: true,
        runtimeModel: 'service',
        remote: { entry: 'remote/index.js', actions: {} }
      },
      {
        name: 'other-tag',
        version: '1.0.0',
        platform: ['linux'],
        tags: ['ocr'],
        remoteSync: true,
        runtimeModel: 'service',
        remote: { entry: 'remote/index.js', actions: {} }
      }
    ]

    const deployable = buildDeployablePluginList(plugins, {
      platform: 'linux',
      tagPolicy: { mode: 'allow_list', tags: ['scp'] }
    })

    expect(deployable.map((plugin) => plugin.name)).toEqual(['scp-tool'])
  })

  it('marks version drift and missing plugins in the sync plan', () => {
    const plan = buildRemoteAgentSyncPlan(
      [
        {
          name: 'scp-tool',
          version: '1.0.0',
          platform: ['linux'],
          tags: ['scp'],
          remoteSync: true,
          runtimeModel: 'service',
          remote: { entry: 'remote/index.js', actions: {} }
        }
      ],
      [
        { name: 'scp-tool', version: '0.9.0' },
        { name: 'legacy-tool', version: '0.1.0' }
      ],
      { uninstallExtraneous: true }
    )

    expect(plan.install).toEqual([])
    expect(plan.upgrade.map((plugin) => plugin.name)).toEqual(['scp-tool'])
    expect(plan.uninstall.map((plugin) => plugin.name)).toEqual(['legacy-tool'])
  })

  it('explains why a plugin cannot be distributed to a machine', () => {
    expect(
      getRemoteDistributionEligibility(
        {
          name: 'no-remote-sync',
          version: '1.0.0',
          platform: ['linux'],
          tags: ['scp']
        },
        { platform: 'linux', tagPolicy: { mode: 'allow_all' } }
      )
    ).toEqual({
      eligible: false,
      reason: 'remote_sync_disabled'
    })

    expect(
      getRemoteDistributionEligibility(
        {
          name: 'missing-runtime-model',
          version: '1.0.0',
          platform: ['linux'],
          tags: ['scp'],
          remoteSync: true,
          remote: { entry: 'remote/index.js', actions: {} }
        },
        { platform: 'linux', tagPolicy: { mode: 'allow_all' } }
      )
    ).toEqual({
      eligible: false,
      reason: 'missing_runtime_model'
    })

    expect(
      getRemoteDistributionEligibility(
        {
          name: 'wrong-platform',
          version: '1.0.0',
          platform: ['darwin'],
          tags: ['scp'],
          remoteSync: true,
          runtimeModel: 'service',
          remote: { entry: 'remote/index.js', actions: {} }
        },
        { platform: 'linux', tagPolicy: { mode: 'allow_all' } }
      )
    ).toEqual({
      eligible: false,
      reason: 'platform_mismatch'
    })
  })
})
