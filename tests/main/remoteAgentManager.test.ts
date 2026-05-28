import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockDbPut = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockListPlugins = vi.hoisted(() => vi.fn())
const mockInstallPlugin = vi.hoisted(() => vi.fn())
const mockConfigurePlugin = vi.hoisted(() => vi.fn())
const mockRestartPlugin = vi.hoisted(() => vi.fn())
const mockUninstallPlugin = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/api/shared/database', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: mockDbPut
  }
}))

vi.mock('fs', () => ({
  promises: {
    readFile: mockReadFile
  }
}))

vi.mock('../../src/main/core/remoteAgent/client', () => ({
  RemoteAgentClient: class {
    public listPlugins = mockListPlugins
    public installPlugin = mockInstallPlugin
    public configurePlugin = mockConfigurePlugin
    public restartPlugin = mockRestartPlugin
    public uninstallPlugin = mockUninstallPlugin
  }
}))

import { RemoteAgentManager } from '../../src/main/core/remoteAgent/manager'

describe('RemoteAgentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbPut.mockReturnValue(undefined)
    mockReadFile.mockResolvedValue(Buffer.from('warehouse-package'))
    mockListPlugins.mockResolvedValue([
      {
        name: 'mysql-helper',
        version: '1.0.0',
        runtimeModel: 'service',
        configStatus: 'missing'
      },
      {
        name: 'legacy-tool',
        version: '0.1.0',
        runtimeModel: 'service'
      }
    ])
    mockInstallPlugin.mockResolvedValue({ success: true })
    mockConfigurePlugin.mockResolvedValue({ success: true })
    mockRestartPlugin.mockResolvedValue({ success: true })
    mockUninstallPlugin.mockResolvedValue({ success: true })

    mockDbGet.mockImplementation((key: string) => {
      switch (key) {
        case 'settings-remote-agents':
          return {
            items: [
              {
                id: 'agent-1',
                name: 'Workshop Linux',
                platform: 'linux',
                tagPolicy: { mode: 'allow_all' },
                status: 'online',
                selectedLocalAddress: '192.168.1.23',
                agentBaseUrl: 'http://10.0.0.5:8123'
              }
            ]
          }
        case 'settings-remote-plugin-warehouse':
          return {
            items: [
              {
                pluginName: 'mysql-helper',
                title: 'MySQL Helper',
                version: '1.2.0',
                sourceType: 'market',
                snapshotCreatedAt: '2026-05-27T10:00:00.000Z',
                packageRef: {
                  storage: 'file',
                  path: '/warehouse/mysql-helper/1.2.0.zpx'
                },
                platform: ['linux'],
                tags: ['db'],
                remoteSync: true,
                runtimeModel: 'service',
                remote: { entry: 'remote/index.js', actions: {} }
              }
            ]
          }
        case 'settings-remote-agent-plugin-configs':
          return [
            {
              machineId: 'agent-1',
              pluginName: 'mysql-helper',
              config: { host: '127.0.0.1' },
              updatedAt: '2026-05-27T09:00:00.000Z'
            }
          ]
        case 'settings-remote-agent-sync-jobs':
          return []
        default:
          return undefined
      }
    })
  })

  it('syncs selected warehouse entries without restart or uninstall side effects', async () => {
    const manager = new RemoteAgentManager()

    const result = await manager.syncRemoteAgent('agent-1', ['mysql-helper'])

    expect(result.success).toBe(true)
    expect(mockReadFile).toHaveBeenCalledWith('/warehouse/mysql-helper/1.2.0.zpx')
    expect(mockInstallPlugin).toHaveBeenCalledWith({
      name: 'mysql-helper',
      version: '1.2.0',
      runtimeModel: 'service',
      packageData: Buffer.from('warehouse-package').toString('base64')
    })
    expect(mockConfigurePlugin).toHaveBeenCalledWith({
      pluginName: 'mysql-helper',
      config: { host: '127.0.0.1' }
    })
    expect(mockRestartPlugin).not.toHaveBeenCalled()
    expect(mockUninstallPlugin).not.toHaveBeenCalled()
  })

  it('deletes a machine together with local configs and sync jobs', async () => {
    mockDbGet.mockImplementation((key: string) => {
      switch (key) {
        case 'settings-remote-agents':
          return {
            items: [
              {
                id: 'agent-1',
                name: 'Workshop Linux',
                platform: 'linux',
                tagPolicy: { mode: 'allow_all' },
                status: 'pending',
                selectedLocalAddress: '192.168.1.23',
                onboardingToken: 'token-1',
                onboardingExpiresAt: '2026-05-27T09:00:00.000Z'
              },
              {
                id: 'agent-2',
                name: 'Backup Linux',
                platform: 'linux',
                tagPolicy: { mode: 'allow_all' },
                status: 'online',
                selectedLocalAddress: '192.168.1.24',
                agentBaseUrl: 'http://10.0.0.6:8123'
              }
            ]
          }
        case 'settings-remote-agent-plugin-configs':
          return [
            {
              machineId: 'agent-1',
              pluginName: 'mysql-helper',
              config: { host: '127.0.0.1' },
              updatedAt: '2026-05-27T09:00:00.000Z'
            },
            {
              machineId: 'agent-2',
              pluginName: 'scp-tool',
              config: { host: '10.0.0.6' },
              updatedAt: '2026-05-27T09:00:00.000Z'
            }
          ]
        case 'settings-remote-agent-sync-jobs':
          return [
            {
              machineId: 'agent-1',
              pluginName: 'mysql-helper',
              action: 'install',
              status: 'success',
              message: 'ok',
              startedAt: '2026-05-27T09:00:00.000Z',
              finishedAt: '2026-05-27T09:00:01.000Z'
            },
            {
              machineId: 'agent-2',
              pluginName: 'scp-tool',
              action: 'configure',
              status: 'success',
              message: 'ok',
              startedAt: '2026-05-27T09:00:00.000Z',
              finishedAt: '2026-05-27T09:00:01.000Z'
            }
          ]
        default:
          return undefined
      }
    })

    const manager = new RemoteAgentManager()
    const result = await manager.deleteRemoteAgent('agent-1')

    expect(result).toEqual({ success: true })
    expect(mockDbPut).toHaveBeenCalledWith('settings-remote-agents', {
      items: [
        expect.objectContaining({
          id: 'agent-2'
        })
      ]
    })
    expect(mockDbPut).toHaveBeenCalledWith('settings-remote-agent-plugin-configs', [
      expect.objectContaining({
        machineId: 'agent-2'
      })
    ])
    expect(mockDbPut).toHaveBeenCalledWith('settings-remote-agent-sync-jobs', [
      expect.objectContaining({
        machineId: 'agent-2'
      })
    ])
  })
})
