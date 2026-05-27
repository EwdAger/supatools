import { describe, expect, it } from 'vitest'
import {
  buildRemotePluginWarehouseMachineItems,
  buildRemotePluginWarehouseOverview,
  buildRemotePluginWarehouseSummary
} from '../../src/main/core/remoteAgent/warehouseView'

describe('remote warehouse view', () => {
  const warehouse = {
    items: [
      {
        pluginName: 'mysql-helper',
        title: 'MySQL Helper',
        version: '1.2.0',
        sourceType: 'market' as const,
        snapshotCreatedAt: '2026-05-27T10:00:00.000Z',
        packageRef: { storage: 'file' as const, path: '/warehouse/mysql-helper/1.2.0.zpx' },
        platform: ['linux'],
        tags: ['db'],
        remoteSync: true,
        runtimeModel: 'service' as const,
        remote: { entry: 'remote/index.js', actions: {} },
        hasMarketUpdate: false
      },
      {
        pluginName: 'desktop-only',
        title: 'Desktop Only',
        version: '1.0.0',
        sourceType: 'market' as const,
        snapshotCreatedAt: '2026-05-26T10:00:00.000Z',
        packageRef: { storage: 'file' as const, path: '/warehouse/desktop-only/1.0.0.zpx' },
        platform: ['darwin'],
        tags: ['design'],
        remoteSync: true,
        runtimeModel: 'service' as const,
        remote: { entry: 'remote/index.js', actions: {} },
        hasMarketUpdate: true,
        latestMarketVersion: '1.1.0'
      }
    ]
  }

  it('sorts overview entries with market updates first', () => {
    const items = buildRemotePluginWarehouseOverview(warehouse)

    expect(items.map((item) => item.pluginName)).toEqual(['desktop-only', 'mysql-helper'])
  })

  it('builds machine rows with eligibility reasons and pending actions', () => {
    const items = buildRemotePluginWarehouseMachineItems({
      warehouse,
      machine: {
        id: 'agent-1',
        platform: 'linux',
        tagPolicy: { mode: 'allow_list', tags: ['db'] }
      },
      remotePlugins: [
        {
          name: 'mysql-helper',
          version: '1.0.0',
          runtimeModel: 'service',
          configStatus: 'missing'
        }
      ],
      savedConfigs: [
        {
          machineId: 'agent-1',
          pluginName: 'mysql-helper',
          config: { host: '127.0.0.1' },
          updatedAt: '2026-05-27T09:00:00.000Z'
        }
      ]
    })

    const mysqlHelper = items.find((item) => item.pluginName === 'mysql-helper')
    const desktopOnly = items.find((item) => item.pluginName === 'desktop-only')

    expect(mysqlHelper).toMatchObject({
      eligible: true,
      hasSavedConfig: true,
      pendingActions: ['upgrade', 'configure']
    })
    expect(desktopOnly).toMatchObject({
      eligible: false,
      ineligibilityReason: 'platform_mismatch',
      pendingActions: []
    })
  })

  it('builds summary counts for machine rows', () => {
    const summary = buildRemotePluginWarehouseSummary([
      {
        hasMarketUpdate: true,
        eligible: true,
        pendingActions: ['upgrade']
      },
      {
        hasMarketUpdate: false,
        eligible: false,
        pendingActions: []
      }
    ])

    expect(summary).toEqual({
      totalEntries: 2,
      updateAvailableEntries: 1,
      eligibleEntries: 1,
      ineligibleEntries: 1,
      pendingSyncEntries: 1
    })
  })
})
