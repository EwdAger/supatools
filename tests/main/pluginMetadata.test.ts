import { describe, expect, it } from 'vitest'
import {
  normalizePluginMetadata,
  supportsRemoteDistribution
} from '../../src/shared/pluginMetadata'

describe('pluginMetadata', () => {
  it('normalizes duplicated platform and tags entries', () => {
    expect(
      normalizePluginMetadata({
        platform: ['linux', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    ).toEqual({
      platform: ['linux', 'win32'],
      tags: ['scp', 'hci'],
      remoteSync: false
    })
  })

  it('returns empty arrays when manifest fields are absent', () => {
    expect(normalizePluginMetadata({})).toEqual({
      platform: [],
      tags: [],
      remoteSync: false
    })
  })

  it('normalizes remote metadata contracts and runtime model', () => {
    expect(
      normalizePluginMetadata({
        platform: [' Linux '],
        tags: ['scp'],
        remoteSync: true,
        runtimeModel: ' Service ',
        local: { entry: ' local/index.js ' },
        remote: {
          entry: ' remote/index.js ',
          actions: {
            fetch_password: {
              input: { type: 'object', required: ['host'] },
              output: { type: 'object', required: ['password'] }
            }
          }
        }
      })
    ).toEqual({
      platform: ['linux'],
      tags: ['scp'],
      remoteSync: true,
      runtimeModel: 'service',
      local: { entry: 'local/index.js' },
      remote: {
        entry: 'remote/index.js',
        actions: {
          fetch_password: {
            input: { type: 'object', required: ['host'] },
            output: { type: 'object', required: ['password'] }
          }
        }
      }
    })
  })

  it('falls back to manifest.main as local entry for backward compatibility', () => {
    expect(
      normalizePluginMetadata({
        main: 'dist/main.js'
      })
    ).toEqual({
      platform: [],
      tags: [],
      remoteSync: false,
      local: { entry: 'dist/main.js' }
    })
  })

  it('requires explicit remote sync, runtime model and remote entry for distribution support', () => {
    expect(
      supportsRemoteDistribution(
        normalizePluginMetadata({
          remoteSync: true,
          runtimeModel: 'service',
          remote: { entry: 'remote/index.js' }
        })
      )
    ).toBe(true)

    expect(
      supportsRemoteDistribution(
        normalizePluginMetadata({
          remoteSync: true,
          runtimeModel: 'service'
        })
      )
    ).toBe(false)
  })
})
