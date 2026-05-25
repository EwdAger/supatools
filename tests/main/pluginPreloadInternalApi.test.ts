import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const moduleLoader = require('module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}
const preloadPath = require.resolve('../../resources/preload.js')
const originalLoad = moduleLoader._load

describe('plugin preload internal api bridge', () => {
  const ipcInvoke = vi.fn()
  const ipcOn = vi.fn()
  const ipcSend = vi.fn()
  const ipcSendSync = vi.fn()
  const ipcRemoveListener = vi.fn()
  const ipcEmit = vi.fn()

  beforeEach(() => {
    delete require.cache[preloadPath]
    ipcInvoke.mockReset().mockResolvedValue({ success: true })
    ipcOn.mockReset()
    ipcSend.mockReset()
    ipcSendSync.mockReset()
    ipcRemoveListener.mockReset()
    ipcEmit.mockReset()
    ;(globalThis as any).window = {
      addEventListener: vi.fn()
    }

    moduleLoader._load = ((request: string, parent: unknown, isMain: boolean) => {
      if (request === 'electron') {
        return {
          ipcRenderer: {
            invoke: ipcInvoke,
            on: ipcOn,
            send: ipcSend,
            sendSync: ipcSendSync,
            removeListener: ipcRemoveListener,
            emit: ipcEmit
          }
        }
      }

      return originalLoad.call(moduleLoader, request, parent, isMain)
    }) as typeof originalLoad
  })

  afterEach(() => {
    delete require.cache[preloadPath]
    moduleLoader._load = originalLoad
    delete (globalThis as any).window
  })

  it('exposes updateDevProjectsOrder for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.updateDevProjectsOrder).toBeTypeOf('function')

    await internalApi.updateDevProjectsOrder(['beta', 'alpha'])

    expect(ipcInvoke).toHaveBeenCalledWith('internal:update-dev-projects-order', ['beta', 'alpha'])
  })

  it('exposes upsertDevProjectByConfigPath for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.upsertDevProjectByConfigPath).toBeTypeOf('function')

    await internalApi.upsertDevProjectByConfigPath('/workspace/demo/plugin.json')

    expect(ipcInvoke).toHaveBeenCalledWith(
      'internal:upsert-dev-project-by-config-path',
      '/workspace/demo/plugin.json'
    )
  })

  it('exposes createRemoteAgent for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.createRemoteAgent).toBeTypeOf('function')

    await internalApi.createRemoteAgent({
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_all' }
    })

    expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agent-create', {
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_all' }
    })
  })

  it('exposes listRemoteAgents for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.listRemoteAgents).toBeTypeOf('function')

    await internalApi.listRemoteAgents()

    expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agents-list')
  })

  it('exposes getRemoteAgentInfo for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.getRemoteAgentInfo).toBeTypeOf('function')

    await internalApi.getRemoteAgentInfo('agent-1')

    expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agent-info', 'agent-1')
  })

  it('exposes listRemoteAgentInstalledPlugins for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.listRemoteAgentInstalledPlugins).toBeTypeOf('function')

    await internalApi.listRemoteAgentInstalledPlugins('agent-1')

    expect(ipcInvoke).toHaveBeenCalledWith('internal:remote-agent-installed-plugins', 'agent-1')
  })

  it('exposes addPluginToRemoteWarehouse for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.addPluginToRemoteWarehouse).toBeTypeOf('function')

    await internalApi.addPluginToRemoteWarehouse({ name: 'remote-ocr-worker', version: '1.6.0' })

    expect(ipcInvoke).toHaveBeenCalledWith('internal:add-plugin-to-remote-warehouse', {
      name: 'remote-ocr-worker',
      version: '1.6.0'
    })
  })

  it('exposes updatePluginInRemoteWarehouse for internal plugin runtimes', async () => {
    require(preloadPath)

    const internalApi = (globalThis as any).window.ztools?.internal

    expect(internalApi?.updatePluginInRemoteWarehouse).toBeTypeOf('function')

    await internalApi.updatePluginInRemoteWarehouse({
      name: 'remote-ocr-worker',
      version: '1.7.0'
    })

    expect(ipcInvoke).toHaveBeenCalledWith('internal:update-plugin-in-remote-warehouse', {
      name: 'remote-ocr-worker',
      version: '1.7.0'
    })
  })
})
