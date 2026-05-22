import { describe, expect, it } from 'vitest'
import {
  markWarehouseEntryMarketState,
  readRemotePluginWarehouse,
  upsertWarehouseEntry
} from '../../src/main/api/renderer/remotePluginWarehouseRegistry'

describe('remotePluginWarehouseRegistry', () => {
  it('normalizes warehouse docs and drops invalid entries', () => {
    const doc = readRemotePluginWarehouse({
      items: [
        {
          pluginName: 'remote-ocr-worker',
          title: 'Remote OCR Worker',
          version: '1.5.0',
          sourceType: 'market',
          snapshotCreatedAt: '2026-05-22T00:00:00.000Z',
          packageRef: {
            storage: 'file',
            path: '/warehouse/remote-ocr-worker-1.5.0.zpx'
          },
          platform: [' Linux '],
          tags: ['ocr', 'OCR'],
          remoteSync: true,
          runtimeModel: 'service',
          local: { entry: ' local/index.js ' },
          remote: {
            entry: ' remote/index.js ',
            actions: {
              fetch_password: {
                input: { type: 'object' },
                output: { type: 'object' }
              }
            }
          }
        },
        {
          bad: true
        }
      ]
    })

    expect(doc.items).toEqual([
      {
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
        local: { entry: 'local/index.js' },
        remote: {
          entry: 'remote/index.js',
          actions: {
            fetch_password: {
              input: { type: 'object' },
              output: { type: 'object' }
            }
          }
        },
        actions: {
          fetch_password: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      }
    ])
  })

  it('upserts warehouse entries and updates market state', () => {
    const initial = readRemotePluginWarehouse({
      items: [
        {
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
          remote: { entry: 'remote/index.js', actions: {} }
        }
      ]
    })

    const upserted = upsertWarehouseEntry(initial, {
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
      remote: { entry: 'remote/index.js', actions: {} }
    })

    expect(upserted.items).toHaveLength(1)
    expect(upserted.items[0].version).toBe('1.6.0')

    const updatedState = markWarehouseEntryMarketState(upserted, 'remote-ocr-worker', '1.7.0')

    expect(updatedState.items[0].hasMarketUpdate).toBe(true)
    expect(updatedState.items[0].latestMarketVersion).toBe('1.7.0')
  })
})
