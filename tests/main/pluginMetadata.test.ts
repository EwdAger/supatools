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
