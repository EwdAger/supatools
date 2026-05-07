import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReadFileSync = vi.hoisted(() => vi.fn())
const mockDbGet = vi.hoisted(() => vi.fn())
const mockDbPut = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync
  }
}))

vi.mock('../../src/main/api/index', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: mockDbPut
  }
}))

vi.mock('../../src/main/core/internalPlugins', () => ({
  BUNDLED_INTERNAL_PLUGIN_NAMES: ['setting'],
  getInternalPluginPath: vi.fn(() => '/mock/internal/setting')
}))

vi.mock('../../src/main/core/internalPluginServer', () => ({
  getInternalPluginServerPort: vi.fn(() => 0),
  getInternalPluginUrl: vi.fn()
}))

import { loadInternalPlugins } from '../../src/main/core/internalPluginLoader'

describe('loadInternalPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        name: 'setting',
        title: 'Setting',
        version: '1.0.0',
        features: [],
        platform: [' Linux ', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    )
    mockDbGet.mockReturnValue([])
  })

  it('persists normalized platform and tags for bundled plugins', () => {
    loadInternalPlugins()

    expect(mockDbPut).toHaveBeenCalledWith(
      'plugins',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'setting',
          platform: ['linux', 'win32'],
          tags: ['scp', 'hci']
        })
      ])
    )
  })
})
