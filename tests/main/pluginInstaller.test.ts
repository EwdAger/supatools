import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockDbPut = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock-user-data')
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  shell: {
    showItemInFolder: vi.fn()
  }
}))

vi.mock('../../src/main/api/shared/database', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: mockDbPut
  }
}))

import { PluginInstallerAPI } from '../../src/main/api/renderer/pluginInstaller'

describe('PluginInstallerAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockReturnValue([])
  })

  it('persists normalized platform and tags in installed plugin records', () => {
    const api = new PluginInstallerAPI({
      mainWindow: null,
      pluginManager: null,
      devProjects: {} as any,
      getPlugins: vi.fn(async () => []),
      readInstalledPlugins: vi.fn(() => []),
      writeInstalledPlugins: vi.fn(),
      notifyPluginsChanged: vi.fn(),
      validatePluginConfig: vi.fn(() => ({ valid: true }))
    })

    const plugin = (api as any).persistPlugin(
      {
        name: 'demo',
        title: 'Demo',
        version: '1.0.0',
        features: [],
        platform: [' Linux ', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      },
      '/plugins/demo'
    )

    expect(plugin.platform).toEqual(['linux', 'win32'])
    expect(plugin.tags).toEqual(['scp', 'hci'])
    expect(plugin.remoteSync).toBe(false)
    expect(mockDbPut).toHaveBeenCalledWith(
      'plugins',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'demo',
          platform: ['linux', 'win32'],
          tags: ['scp', 'hci']
        })
      ])
    )
  })

  it('persists remote metadata in installed plugin records', () => {
    const api = new PluginInstallerAPI({
      mainWindow: null,
      pluginManager: null,
      devProjects: {} as any,
      getPlugins: vi.fn(async () => []),
      readInstalledPlugins: vi.fn(() => []),
      writeInstalledPlugins: vi.fn(),
      notifyPluginsChanged: vi.fn(),
      validatePluginConfig: vi.fn(() => ({ valid: true }))
    })

    const plugin = (api as any).persistPlugin(
      {
        name: 'demo',
        title: 'Demo',
        version: '1.0.0',
        features: [],
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
        }
      },
      '/plugins/demo'
    )

    expect(plugin.remoteSync).toBe(true)
    expect(plugin.runtimeModel).toBe('service')
    expect(plugin.local).toEqual({ entry: 'local/index.js' })
    expect(plugin.remote).toEqual({
      entry: 'remote/index.js',
      actions: {
        fetch_password: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    })
  })
})
