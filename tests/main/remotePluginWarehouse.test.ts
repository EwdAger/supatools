import { describe, expect, it } from 'vitest'
import {
  createEmptyRemotePluginWarehouseDoc,
  upsertRemotePluginWarehouseEntry,
  REMOTE_PLUGIN_WAREHOUSE_DB_KEY
} from '../../src/shared/remotePluginWarehouse'

describe('remotePluginWarehouse', () => {
  it('creates an empty warehouse doc', () => {
    expect(createEmptyRemotePluginWarehouseDoc()).toEqual({ items: [] })
  })

  it('upserts warehouse entries by plugin identity', () => {
    const initial = createEmptyRemotePluginWarehouseDoc()
    const withEntry = upsertRemotePluginWarehouseEntry(initial, {
      pluginName: 'remote-ocr-worker',
      title: 'Remote OCR Worker',
      version: '1.5.0',
      sourceType: 'market',
      snapshotCreatedAt: '2026-05-22T00:00:00.000Z',
      packageRef: {
        storage: 'file',
        path: '/warehouse/remote-ocr-worker-1.5.0.zpx'
      },
      platform: ['linux'],
      tags: ['ocr'],
      remoteSync: true,
      runtimeModel: 'service',
      hasMarketUpdate: false,
      actions: {
        fetch_password: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    })

    const updated = upsertRemotePluginWarehouseEntry(withEntry, {
      pluginName: 'remote-ocr-worker',
      title: 'Remote OCR Worker',
      version: '1.6.0',
      sourceType: 'market',
      snapshotCreatedAt: '2026-05-22T08:00:00.000Z',
      packageRef: {
        storage: 'file',
        path: '/warehouse/remote-ocr-worker-1.6.0.zpx'
      },
      platform: ['linux'],
      tags: ['ocr'],
      remoteSync: true,
      runtimeModel: 'service',
      hasMarketUpdate: true
    })

    expect(REMOTE_PLUGIN_WAREHOUSE_DB_KEY).toBe('settings-remote-plugin-warehouse')
    expect(withEntry.items).toHaveLength(1)
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0].version).toBe('1.6.0')
    expect(updated.items[0].packageRef.path).toBe('/warehouse/remote-ocr-worker-1.6.0.zpx')
  })
})
