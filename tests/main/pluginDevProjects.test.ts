import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbGet = vi.hoisted(() => vi.fn())
const mockDbPut = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockWriteFile = vi.hoisted(() => vi.fn())
const mockAccess = vi.hoisted(() => vi.fn())
const mockCp = vi.hoisted(() => vi.fn())
const mockStat = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  shell: {
    showItemInFolder: vi.fn()
  }
}))

vi.mock('fs', () => ({
  promises: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    access: mockAccess,
    cp: mockCp,
    stat: mockStat
  }
}))

vi.mock('../../src/main/api/shared/database', () => ({
  default: {
    dbGet: mockDbGet,
    dbPut: mockDbPut
  }
}))

vi.mock('../../src/main/core/internalPlugins', () => ({
  isBundledInternalPlugin: vi.fn(() => false)
}))

vi.mock('../../src/main/utils/zpxArchive.js', () => ({
  packZpx: vi.fn()
}))

import { dialog } from 'electron'
import {
  DEV_PROJECT_REGISTRY_DB_KEY,
  type DevProjectRegistry
} from '../../src/main/api/renderer/pluginDevelopmentRegistry'
import { PluginDevProjectsAPI } from '../../src/main/api/renderer/pluginDevProjects'
import { packZpx } from '../../src/main/utils/zpxArchive.js'

function createRegistry(): DevProjectRegistry {
  return {
    version: 3,
    projects: {
      demo: {
        name: 'demo',
        configSnapshot: {
          name: 'demo',
          title: 'Demo',
          platform: [' Linux ', 'linux', '', 'win32'],
          tags: [' SCP ', 'scp', '']
        },
        addedAt: '2026-04-15T00:00:00.000Z',
        updatedAt: '2026-04-15T00:00:00.000Z',
        sortOrder: 0,
        projectPath: '/workspace/demo',
        configPath: '/workspace/demo/plugin.json',
        status: 'ready',
        lastValidatedAt: '2026-04-15T00:00:00.000Z'
      }
    }
  }
}

function createApi(): PluginDevProjectsAPI {
  return new PluginDevProjectsAPI({
    mainWindow: null,
    pluginManager: null,
    readInstalledPlugins: () => [],
    writeInstalledPlugins: vi.fn(),
    notifyPluginsChanged: vi.fn(),
    validatePluginConfig: vi.fn(() => ({ valid: true })),
    resolvePluginLogo: vi.fn(() => ''),
    getRunningPlugins: vi.fn(() => [])
  })
}

function expectLatestRegistrySnapshot(): { platform?: string[]; tags?: string[] } {
  const calls = mockDbPut.mock.calls.filter(([key]) => key === DEV_PROJECT_REGISTRY_DB_KEY)
  const latest = calls.at(-1)?.[1] as DevProjectRegistry | undefined
  if (!latest) throw new Error('Expected registry write')
  return latest.projects.demo.configSnapshot
}

function findWriteCall(targetPath: string): string {
  const call = mockWriteFile.mock.calls.find(([filePath]) => filePath === targetPath)
  if (!call) throw new Error(`Expected writeFile call for ${targetPath}`)
  return call[1] as string
}

describe('PluginDevProjectsAPI metadata canonicalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockImplementation((key: string) => {
      if (key === DEV_PROJECT_REGISTRY_DB_KEY) {
        return createRegistry()
      }
      return []
    })
    mockAccess.mockResolvedValue(undefined)
    mockCp.mockResolvedValue(undefined)
    mockStat.mockResolvedValue(null)
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('persists canonical platform and tags when validating a project', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        name: 'demo',
        title: 'Demo',
        version: '1.0.0',
        platform: [' Linux ', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    )

    const api = createApi()
    const result = await api.validateDevProject('demo')

    expect(result.success).toBe(true)
    expect(expectLatestRegistrySnapshot()).toMatchObject({
      platform: ['linux', 'win32'],
      tags: ['scp', 'hci']
    })
  })

  it('includes canonical tags in getDevProjects output', async () => {
    const api = createApi()

    const result = await api.getDevProjects()

    expect(result).toEqual([
      expect.objectContaining({
        name: 'demo',
        platform: ['linux', 'win32'],
        tags: ['scp']
      })
    ])
  })

  it('persists canonical platform and tags when selecting a replacement config', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        name: 'demo',
        title: 'Demo',
        version: '1.0.0',
        platform: [' Linux ', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    )

    const api = createApi()
    const result = await api.selectDevProjectConfig('demo', '/workspace/demo-next/plugin.json')

    expect(result.success).toBe(true)
    expect(expectLatestRegistrySnapshot()).toMatchObject({
      platform: ['linux', 'win32'],
      tags: ['scp', 'hci']
    })
  })

  it('persists canonical platform when updating project metadata', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        name: 'demo',
        title: 'Demo',
        version: '1.0.0'
      })
    )

    const api = createApi()
    const result = await api.updateDevProjectMeta('demo', {
      platform: [' Linux ', 'linux', '', 'win32']
    })

    expect(result.success).toBe(true)
    expect(expectLatestRegistrySnapshot()).toMatchObject({
      platform: ['linux', 'win32'],
      tags: ['scp']
    })
    expect(JSON.parse(findWriteCall('/workspace/demo/plugin.json'))).toMatchObject({
      platform: ['linux', 'win32']
    })
  })

  it('writes canonical platform to scaffolded public/plugin.json', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === '/workspace/demo/public/plugin.json') {
        return JSON.stringify({
          name: '{{PLUGIN_NAME}}',
          title: '{{PLUGIN_TITLE}}',
          description: '{{DESCRIPTION}}',
          author: '{{AUTHOR}}'
        })
      }
      if (filePath === '/workspace/demo/package.json') {
        return JSON.stringify({
          name: '{{PROJECT_NAME}}',
          description: '{{DESCRIPTION}}'
        })
      }
      throw new Error(`Unexpected read: ${filePath}`)
    })

    const api = new PluginDevProjectsAPI({
      mainWindow: null,
      pluginManager: null,
      readInstalledPlugins: () => [{ name: 'ztools-developer-plugin__dev', path: '/developer' }],
      writeInstalledPlugins: vi.fn(),
      notifyPluginsChanged: vi.fn(),
      validatePluginConfig: vi.fn(() => ({ valid: true })),
      resolvePluginLogo: vi.fn(() => ''),
      getRunningPlugins: vi.fn(() => [])
    })
    ;(api as any).upsertDevProjectByConfigPath = vi.fn().mockResolvedValue({
      success: true,
      pluginName: 'demo'
    })

    const result = await api.scaffoldDevProject({
      template: 'vue-vite',
      projectPath: '/workspace',
      name: 'demo',
      title: 'Demo',
      description: 'Example',
      author: 'Alice',
      platform: [' Linux ', 'linux', '', 'win32']
    })

    expect(result.success).toBe(true)
    expect(JSON.parse(findWriteCall('/workspace/demo/public/plugin.json'))).toMatchObject({
      name: 'demo',
      title: 'Demo',
      description: 'Example',
      author: 'Alice',
      platform: ['linux', 'win32']
    })
  })

  it('writes canonical platform and tags when overriding version for packaging', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        name: 'demo',
        title: 'Demo',
        version: '1.0.0',
        platform: [' Linux ', 'linux', '', 'win32'],
        tags: ['scp', 'HCI', 'scp', '']
      })
    )
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/tmp/demo-v2.0.0.zpx'
    } as any)
    vi.mocked(packZpx).mockResolvedValue(undefined as any)

    const api = createApi()
    const result = await api.packageDevProject('demo', undefined, '2.0.0')

    expect(result.success).toBe(true)
    expect(JSON.parse(findWriteCall('/workspace/demo/plugin.json'))).toMatchObject({
      version: '2.0.0',
      platform: ['linux', 'win32'],
      tags: ['scp', 'hci']
    })
  })
})
