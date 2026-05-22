import type {
  PluginActionContract,
  PluginLocalMetadata,
  PluginRemoteMetadata,
  PluginRuntimeModel
} from './pluginMetadata'

export const REMOTE_PLUGIN_WAREHOUSE_DB_KEY = 'settings-remote-plugin-warehouse'

export type RemotePluginSourceType = 'market' | 'local_file' | 'development'

export interface RemotePluginPackageRef {
  storage: 'file'
  path: string
}

export interface RemotePluginWarehouseEntry {
  pluginName: string
  title: string
  version: string
  sourceType: RemotePluginSourceType
  snapshotCreatedAt: string
  packageRef: RemotePluginPackageRef
  platform: string[]
  tags: string[]
  remoteSync: boolean
  runtimeModel?: PluginRuntimeModel
  local?: PluginLocalMetadata
  remote?: PluginRemoteMetadata
  actions?: Record<string, PluginActionContract>
  hasMarketUpdate?: boolean
  latestMarketVersion?: string
}

export interface RemotePluginWarehouseDoc {
  items: RemotePluginWarehouseEntry[]
}

export function createEmptyRemotePluginWarehouseDoc(): RemotePluginWarehouseDoc {
  return { items: [] }
}

export function upsertRemotePluginWarehouseEntry(
  doc: RemotePluginWarehouseDoc,
  entry: RemotePluginWarehouseEntry
): RemotePluginWarehouseDoc {
  const others = doc.items.filter((item) => item.pluginName !== entry.pluginName)
  return {
    items: [...others, entry]
  }
}
