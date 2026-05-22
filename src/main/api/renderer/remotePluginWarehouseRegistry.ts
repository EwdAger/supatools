import type {
  RemotePluginWarehouseDoc,
  RemotePluginWarehouseEntry
} from '../../../shared/remotePluginWarehouse'
import { createEmptyRemotePluginWarehouseDoc } from '../../../shared/remotePluginWarehouse'
import {
  normalizePluginMetadata,
  type NormalizedPluginMetadata,
  type PluginActionContract
} from '../../../shared/pluginMetadata'

function normalizeTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function normalizeActions(
  metadata: NormalizedPluginMetadata
): Record<string, PluginActionContract> | undefined {
  const actions = metadata.remote?.actions
  if (!actions || Object.keys(actions).length === 0) return undefined
  return actions
}

function parseWarehouseEntry(
  raw: unknown,
  fallbackTimestamp: string
): RemotePluginWarehouseEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const entry = raw as Record<string, unknown>
  const pluginName = normalizeOptionalString(entry.pluginName)
  const title = normalizeOptionalString(entry.title)
  const version = normalizeOptionalString(entry.version)
  const sourceType = entry.sourceType
  const packageRef = entry.packageRef

  if (!pluginName || !title || !version) return null
  if (sourceType !== 'market' && sourceType !== 'local_file' && sourceType !== 'development')
    return null
  if (!packageRef || typeof packageRef !== 'object' || Array.isArray(packageRef)) return null

  const packagePath = normalizeOptionalString((packageRef as Record<string, unknown>).path)
  if (!packagePath) return null

  const metadata = normalizePluginMetadata({
    platform: entry.platform,
    tags: entry.tags,
    remoteSync: entry.remoteSync,
    runtimeModel: entry.runtimeModel,
    local: entry.local,
    remote: entry.remote
  })

  return {
    pluginName,
    title,
    version,
    sourceType,
    snapshotCreatedAt: normalizeTimestamp(entry.snapshotCreatedAt, fallbackTimestamp),
    packageRef: {
      storage: 'file',
      path: packagePath
    },
    platform: metadata.platform,
    tags: metadata.tags,
    remoteSync: metadata.remoteSync,
    ...(metadata.runtimeModel ? { runtimeModel: metadata.runtimeModel } : {}),
    ...(metadata.local ? { local: metadata.local } : {}),
    ...(metadata.remote ? { remote: metadata.remote } : {}),
    ...(normalizeActions(metadata) ? { actions: normalizeActions(metadata) } : {}),
    ...(typeof entry.hasMarketUpdate === 'boolean'
      ? { hasMarketUpdate: entry.hasMarketUpdate }
      : {}),
    ...(normalizeOptionalString(entry.latestMarketVersion)
      ? { latestMarketVersion: normalizeOptionalString(entry.latestMarketVersion) }
      : {})
  }
}

export function readRemotePluginWarehouse(raw: unknown): RemotePluginWarehouseDoc {
  const emptyDoc = createEmptyRemotePluginWarehouseDoc()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyDoc

  const doc = raw as { items?: unknown }
  if (!Array.isArray(doc.items)) return emptyDoc

  const fallbackTimestamp = new Date().toISOString()
  return {
    items: doc.items
      .map((item) => parseWarehouseEntry(item, fallbackTimestamp))
      .filter((item): item is RemotePluginWarehouseEntry => !!item)
  }
}

export function upsertWarehouseEntry(
  doc: RemotePluginWarehouseDoc,
  entry: RemotePluginWarehouseEntry
): RemotePluginWarehouseDoc {
  const others = doc.items.filter((item) => item.pluginName !== entry.pluginName)
  return {
    items: [...others, entry]
  }
}

export function markWarehouseEntryMarketState(
  doc: RemotePluginWarehouseDoc,
  pluginName: string,
  latestMarketVersion?: string
): RemotePluginWarehouseDoc {
  return {
    items: doc.items.map((item) =>
      item.pluginName !== pluginName
        ? item
        : {
            ...item,
            hasMarketUpdate: !!latestMarketVersion && latestMarketVersion !== item.version,
            ...(latestMarketVersion ? { latestMarketVersion } : { latestMarketVersion: undefined })
          }
    )
  }
}
