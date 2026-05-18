import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockHttpGet = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('fs', () => ({
  promises: {
    readFile: mockReadFile,
    rm: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    cp: vi.fn(),
    stat: vi.fn()
  }
}))

vi.mock('../../src/main/api/shared/database', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: vi.fn(),
    clearPluginData: vi.fn()
  }
}))

vi.mock('../../src/main/core/internalPlugins', () => ({
  isBundledInternalPlugin: vi.fn(() => false)
}))

vi.mock('../../src/main/managers/windowManager', () => ({
  default: {
    notifyBackToSearch: vi.fn()
  }
}))

vi.mock('../../src/main/api/plugin/feature', () => ({
  pluginFeatureAPI: {
    loadDynamicFeatures: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/api/renderer/webSearch', () => ({
  default: {
    getSearchEngineFeatures: vi.fn(async () => [])
  }
}))

vi.mock('../../src/main/core/lmdb/lmdbInstance', () => ({
  default: {
    allDocs: vi.fn(() => []),
    get: vi.fn(() => null)
  }
}))

vi.mock('../../src/main/utils/httpRequest.js', () => ({
  httpGet: mockHttpGet
}))

vi.mock('../../src/main/api/renderer/pluginInstaller', () => ({
  PluginInstallerAPI: class {}
}))

vi.mock('../../src/main/api/renderer/pluginMarket', () => ({
  PluginMarketAPI: class {}
}))

vi.mock('../../src/main/api/renderer/pluginDevProjects', () => ({
  PluginDevProjectsAPI: class {}
}))

import { PluginsAPI } from '../../src/main/api/renderer/plugins'

describe('plugin readme resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockReturnValue([])
    mockReadFile.mockReset()
    mockHttpGet.mockReset()
  })

  it('uses descriptionURL from cached market data for uninstalled plugins', async () => {
    mockDbGet.mockImplementation((key: string) => {
      if (key === 'plugin-market-data') {
        return [
          {
            name: 'demo-plugin',
            descriptionURL: 'https://gitlab.example.com/team/demo/-/raw/main/README.md'
          }
        ]
      }
      return []
    })
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: '# Demo\n![img](./assets/demo.png)\n[guide](./docs/guide.md)'
    })

    const api = new PluginsAPI()
    const result = await api.getPluginReadme('demo-plugin')

    expect(mockHttpGet).toHaveBeenCalledWith(
      'https://gitlab.example.com/team/demo/-/raw/main/README.md',
      expect.any(Object)
    )
    expect(result.success).toBe(true)
    expect(result.content).toContain(
      'https://gitlab.example.com/team/demo/-/raw/main/assets/demo.png'
    )
    expect(result.content).toContain(
      'https://gitlab.example.com/team/demo/-/raw/main/docs/guide.md'
    )
    expect(result.content).not.toContain(
      'https://raw.githubusercontent.com/ZToolsCenter/ZTools-plugins/main/plugins/demo-plugin/assets/demo.png'
    )
  })

  it('falls back to GitHub raw README when descriptionURL is missing', async () => {
    mockDbGet.mockImplementation((key: string) => {
      if (key === 'plugin-market-data') {
        return [{ name: 'demo-plugin' }]
      }
      return []
    })
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: '# Demo'
    })

    const api = new PluginsAPI()
    await api.getPluginReadme('demo-plugin')

    expect(mockHttpGet).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/ZToolsCenter/ZTools-plugins/main/plugins/demo-plugin/README.md',
      expect.any(Object)
    )
  })

  it('keeps installed plugin README loading local-first', async () => {
    mockReadFile.mockResolvedValue('# Local README')

    const api = new PluginsAPI()
    const result = await api.getPluginReadme('/tmp/demo-plugin')

    expect(mockReadFile).toHaveBeenCalled()
    expect(mockHttpGet).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, content: '# Local README' })
  })
})
