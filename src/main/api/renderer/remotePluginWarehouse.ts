import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { downloadFile } from '../../utils/download.js'
import { isValidZpx, readTextFromZpx } from '../../utils/zpxArchive.js'
import {
  REMOTE_PLUGIN_WAREHOUSE_DB_KEY,
  type RemotePluginSourceType,
  type RemotePluginWarehouseDoc,
  type RemotePluginWarehouseEntry
} from '../../../shared/remotePluginWarehouse'
import { createEmptyRemotePluginWarehouseDoc } from '../../../shared/remotePluginWarehouse'
import { normalizePluginMetadata, supportsRemoteDistribution } from '../../../shared/pluginMetadata'
import {
  markWarehouseEntryMarketState,
  readRemotePluginWarehouse,
  upsertWarehouseEntry
} from './remotePluginWarehouseRegistry'

const REMOTE_PLUGIN_WAREHOUSE_DIR = path.join(app.getPath('userData'), 'remote-plugin-warehouse')

export type RemoteWarehouseState = 'unsupported' | 'not_added' | 'up_to_date' | 'update_available'

export type MarketWarehouseAwarePlugin = {
  name: string
  version: string
  title?: string
  description?: string
  logo?: string
  downloadUrl?: string
  platform?: string[]
  tags?: string[]
  remoteSync?: boolean
  runtimeModel?: unknown
  local?: unknown
  remote?: unknown
  remoteDistributionSupported?: boolean
  remoteWarehouseState?: RemoteWarehouseState
  remoteWarehouseVersion?: string
  [key: string]: unknown
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

async function readPluginJson(filePath: string): Promise<{ config: any; isZpx: boolean }> {
  const zpx = await isValidZpx(filePath)
  let content: string
  try {
    if (zpx) {
      content = await readTextFromZpx(filePath, 'plugin.json')
    } else {
      const zip = new AdmZip(filePath)
      content = zip.readAsText('plugin.json')
      if (!content) throw new Error()
    }
  } catch {
    throw new Error('无效的插件文件：缺少 plugin.json')
  }

  let config: any
  try {
    config = JSON.parse(content)
  } catch {
    throw new Error('无效的插件文件：plugin.json 格式错误')
  }

  if (!config.name) throw new Error('无效的插件文件：缺少 name 字段')
  return { config, isZpx: zpx }
}

export class RemotePluginWarehouseAPI {
  public readWarehouse(): RemotePluginWarehouseDoc {
    return readRemotePluginWarehouse(this.dbGet(REMOTE_PLUGIN_WAREHOUSE_DB_KEY))
  }

  public writeWarehouse(doc: RemotePluginWarehouseDoc): void {
    this.dbPut(REMOTE_PLUGIN_WAREHOUSE_DB_KEY, doc)
  }

  public enrichMarketPlugins(plugins: MarketWarehouseAwarePlugin[]): MarketWarehouseAwarePlugin[] {
    const warehouse = this.readWarehouse()
    const warehouseByName = new Map(warehouse.items.map((item) => [item.pluginName, item]))

    return plugins.map((plugin) => {
      const metadata = normalizePluginMetadata(plugin)
      const supported = supportsRemoteDistribution(metadata)
      const entry = warehouseByName.get(plugin.name)

      let state: RemoteWarehouseState = 'unsupported'
      if (supported) {
        if (!entry) {
          state = 'not_added'
        } else if (entry.version === plugin.version) {
          state = 'up_to_date'
        } else {
          state = 'update_available'
        }
      }

      return {
        ...plugin,
        remoteDistributionSupported: supported,
        remoteWarehouseState: state,
        ...(entry ? { remoteWarehouseVersion: entry.version } : {})
      }
    })
  }

  public async addFromMarket(plugin: MarketWarehouseAwarePlugin): Promise<{
    success: boolean
    entry?: RemotePluginWarehouseEntry
    state?: RemoteWarehouseState
    error?: string
  }> {
    return await this.upsertFromMarket(plugin, 'market')
  }

  public async updateFromMarket(plugin: MarketWarehouseAwarePlugin): Promise<{
    success: boolean
    entry?: RemotePluginWarehouseEntry
    state?: RemoteWarehouseState
    error?: string
  }> {
    return await this.upsertFromMarket(plugin, 'market')
  }

  private async upsertFromMarket(
    plugin: MarketWarehouseAwarePlugin,
    sourceType: RemotePluginSourceType
  ): Promise<{
    success: boolean
    entry?: RemotePluginWarehouseEntry
    state?: RemoteWarehouseState
    error?: string
  }> {
    try {
      if (!plugin.downloadUrl) {
        return { success: false, error: '无效的下载链接' }
      }

      const advertisedMetadata = normalizePluginMetadata(plugin)
      if (!supportsRemoteDistribution(advertisedMetadata)) {
        return { success: false, error: '插件未声明完整的远程分发能力' }
      }

      await fs.mkdir(REMOTE_PLUGIN_WAREHOUSE_DIR, { recursive: true })

      const tempDir = path.join(app.getPath('temp'), 'ztools-remote-plugin-warehouse')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFilePath = path.join(tempDir, `${plugin.name}-${Date.now()}.zpx`)
      await downloadFile(plugin.downloadUrl, tempFilePath)

      const { config } = await readPluginJson(tempFilePath)
      const metadata = normalizePluginMetadata(config)
      if (!supportsRemoteDistribution(metadata)) {
        await fs.rm(tempFilePath, { force: true })
        return { success: false, error: '插件包内未声明完整的远程分发能力' }
      }

      const entryVersion = normalizeOptionalString(config.version) || plugin.version
      const entryTitle = normalizeOptionalString(config.title) || plugin.title || plugin.name

      const pluginDir = path.join(REMOTE_PLUGIN_WAREHOUSE_DIR, plugin.name)
      await fs.mkdir(pluginDir, { recursive: true })
      const snapshotPath = path.join(pluginDir, `${entryVersion}.zpx`)
      await fs.copyFile(tempFilePath, snapshotPath)
      await fs.rm(tempFilePath, { force: true })

      const entry: RemotePluginWarehouseEntry = {
        pluginName: plugin.name,
        title: entryTitle,
        version: entryVersion,
        sourceType,
        snapshotCreatedAt: new Date().toISOString(),
        packageRef: {
          storage: 'file',
          path: snapshotPath
        },
        platform: metadata.platform,
        tags: metadata.tags,
        remoteSync: metadata.remoteSync,
        ...(metadata.runtimeModel ? { runtimeModel: metadata.runtimeModel } : {}),
        ...(metadata.local ? { local: metadata.local } : {}),
        ...(metadata.remote ? { remote: metadata.remote } : {}),
        ...(metadata.remote?.actions ? { actions: metadata.remote.actions } : {})
      }

      const current = this.readWarehouse()
      let next = upsertWarehouseEntry(current || createEmptyRemotePluginWarehouseDoc(), entry)
      next = markWarehouseEntryMarketState(next, plugin.name, plugin.version)
      this.writeWarehouse(next)

      return {
        success: true,
        entry,
        state: entryVersion === plugin.version ? 'up_to_date' : 'update_available'
      }
    } catch (error: unknown) {
      console.error('[RemoteWarehouse] 写入市场插件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '写入远程插件仓失败'
      }
    }
  }

  constructor(
    private readonly dbGet: (key: string) => unknown,
    private readonly dbPut: (key: string, value: unknown) => void
  ) {}
}
