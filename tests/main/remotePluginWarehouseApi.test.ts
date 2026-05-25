import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockDbPut = vi.hoisted(() => vi.fn())
const mockDownloadFile = vi.hoisted(() => vi.fn())
const mockReadTextFromZpx = vi.hoisted(() => vi.fn())
const mockIsValidZpx = vi.hoisted(() => vi.fn())
const mockMkdir = vi.hoisted(() => vi.fn())
const mockCopyFile = vi.hoisted(() => vi.fn())
const mockRm = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/mock-user-data'
      if (name === 'temp') return '/mock-temp'
      return '/mock-other'
    })
  }
}))

vi.mock('fs', () => ({
  promises: {
    mkdir: mockMkdir,
    copyFile: mockCopyFile,
    rm: mockRm
  }
}))

vi.mock('../../src/main/utils/download.js', () => ({
  downloadFile: mockDownloadFile
}))

vi.mock('../../src/main/utils/zpxArchive.js', () => ({
  isValidZpx: mockIsValidZpx,
  readTextFromZpx: mockReadTextFromZpx
}))

import { RemotePluginWarehouseAPI } from '../../src/main/api/renderer/remotePluginWarehouse'

describe('RemotePluginWarehouseAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockReturnValue({ items: [] })
    mockMkdir.mockResolvedValue(undefined)
    mockCopyFile.mockResolvedValue(undefined)
    mockRm.mockResolvedValue(undefined)
    mockDownloadFile.mockResolvedValue(undefined)
    mockIsValidZpx.mockResolvedValue(true)
    mockReadTextFromZpx.mockResolvedValue(
      JSON.stringify({
        name: 'remote-ocr-worker',
        title: 'Remote OCR Worker',
        version: '1.6.0',
        remoteSync: true,
        runtimeModel: 'service',
        platform: ['linux'],
        tags: ['ocr'],
        remote: {
          entry: 'remote/index.js',
          actions: {
            fetch_password: {
              input: { type: 'object' },
              output: { type: 'object' }
            }
          }
        }
      })
    )
  })

  it('enriches market plugins with warehouse state', () => {
    mockDbGet.mockReturnValue({
      items: [
        {
          pluginName: 'remote-ocr-worker',
          title: 'Remote OCR Worker',
          version: '1.5.0',
          sourceType: 'market',
          snapshotCreatedAt: '2026-05-25T00:00:00.000Z',
          packageRef: { storage: 'file', path: '/warehouse/remote-ocr-worker-1.5.0.zpx' },
          platform: ['linux'],
          tags: ['ocr'],
          remoteSync: true,
          runtimeModel: 'service',
          remote: { entry: 'remote/index.js', actions: {} }
        }
      ]
    })

    const api = new RemotePluginWarehouseAPI(mockDbGet, mockDbPut)
    const result = api.enrichMarketPlugins([
      {
        name: 'remote-ocr-worker',
        version: '1.6.0',
        remoteSync: true,
        runtimeModel: 'service',
        remote: { entry: 'remote/index.js', actions: {} }
      },
      {
        name: 'desktop-only',
        version: '1.0.0'
      }
    ])

    expect(result[0].remoteDistributionSupported).toBe(true)
    expect(result[0].remoteWarehouseState).toBe('update_available')
    expect(result[0].remoteWarehouseVersion).toBe('1.5.0')
    expect(result[1].remoteDistributionSupported).toBe(false)
    expect(result[1].remoteWarehouseState).toBe('unsupported')
  })

  it('downloads market plugin and writes a warehouse snapshot', async () => {
    const api = new RemotePluginWarehouseAPI(mockDbGet, mockDbPut)

    const result = await api.addFromMarket({
      name: 'remote-ocr-worker',
      title: 'Remote OCR Worker',
      version: '1.6.0',
      downloadUrl: 'https://example.com/remote-ocr-worker.zpx',
      remoteSync: true,
      runtimeModel: 'service',
      remote: { entry: 'remote/index.js', actions: {} }
    })

    expect(result.success).toBe(true)
    expect(result.state).toBe('up_to_date')
    expect(mockDownloadFile).toHaveBeenCalled()
    expect(mockCopyFile).toHaveBeenCalled()
    expect(mockDbPut).toHaveBeenCalledWith(
      'settings-remote-plugin-warehouse',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            pluginName: 'remote-ocr-worker',
            version: '1.6.0'
          })
        ]
      })
    )
  })

  it('rejects market plugins that do not declare full remote distribution capability', async () => {
    const api = new RemotePluginWarehouseAPI(mockDbGet, mockDbPut)

    const result = await api.addFromMarket({
      name: 'desktop-only',
      version: '1.0.0',
      downloadUrl: 'https://example.com/desktop-only.zpx'
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/远程分发能力/)
  })
})
