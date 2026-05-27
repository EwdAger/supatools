import type {
  RemoteAgentPluginConfigRecord,
  RemoteAgentPluginStatus,
  RemoteAgentRecord
} from '../../../shared/remoteAgent'
import type {
  RemotePluginWarehouseDoc,
  RemotePluginWarehouseEntry,
  RemotePluginWarehouseMachineItem,
  RemotePluginWarehouseOverviewItem,
  RemotePluginWarehouseSummary,
  RemotePluginWarehouseSyncAction
} from '../../../shared/remotePluginWarehouse'
import { getRemoteDistributionEligibility } from './deployment'

type MachineViewInput = {
  warehouse: RemotePluginWarehouseDoc
  machine: Pick<RemoteAgentRecord, 'id' | 'platform' | 'tagPolicy'>
  remotePlugins: RemoteAgentPluginStatus[]
  savedConfigs: RemoteAgentPluginConfigRecord[]
}

function buildOverviewItem(entry: RemotePluginWarehouseEntry): RemotePluginWarehouseOverviewItem {
  return {
    pluginName: entry.pluginName,
    title: entry.title,
    version: entry.version,
    sourceType: entry.sourceType,
    snapshotCreatedAt: entry.snapshotCreatedAt,
    platform: entry.platform,
    tags: entry.tags,
    ...(entry.runtimeModel ? { runtimeModel: entry.runtimeModel } : {}),
    ...(typeof entry.hasMarketUpdate === 'boolean'
      ? { hasMarketUpdate: entry.hasMarketUpdate }
      : {}),
    ...(entry.latestMarketVersion ? { latestMarketVersion: entry.latestMarketVersion } : {})
  }
}

function sortWarehouseItems<
  T extends { title: string; hasMarketUpdate?: boolean; snapshotCreatedAt: string }
>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if ((left.hasMarketUpdate ? 1 : 0) !== (right.hasMarketUpdate ? 1 : 0)) {
      return left.hasMarketUpdate ? -1 : 1
    }

    const timeDiff =
      new Date(right.snapshotCreatedAt).getTime() - new Date(left.snapshotCreatedAt).getTime()
    if (timeDiff !== 0) return timeDiff

    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

function buildPendingActions(
  entry: RemotePluginWarehouseEntry,
  remoteStatus: RemoteAgentPluginStatus | undefined,
  hasSavedConfig: boolean
): RemotePluginWarehouseSyncAction[] {
  const actions: RemotePluginWarehouseSyncAction[] = []

  if (!remoteStatus) {
    actions.push('install')
  } else if (remoteStatus.version !== entry.version) {
    actions.push('upgrade')
  }

  if (hasSavedConfig && entry.runtimeModel && entry.runtimeModel !== 'static') {
    actions.push('configure')
  }

  return actions
}

export function buildRemotePluginWarehouseSummary(
  items: Array<{ hasMarketUpdate?: boolean; eligible?: boolean; pendingActions?: string[] }>
): RemotePluginWarehouseSummary {
  const eligibleEntries = items.filter((item) => item.eligible === true).length
  const ineligibleEntries = items.filter((item) => item.eligible === false).length
  const pendingSyncEntries = items.filter((item) => (item.pendingActions?.length || 0) > 0).length

  return {
    totalEntries: items.length,
    updateAvailableEntries: items.filter((item) => item.hasMarketUpdate === true).length,
    ...(items.some((item) => typeof item.eligible === 'boolean') ? { eligibleEntries } : {}),
    ...(items.some((item) => typeof item.eligible === 'boolean') ? { ineligibleEntries } : {}),
    ...(items.some((item) => Array.isArray(item.pendingActions)) ? { pendingSyncEntries } : {})
  }
}

export function buildRemotePluginWarehouseOverview(
  warehouse: RemotePluginWarehouseDoc
): RemotePluginWarehouseOverviewItem[] {
  return sortWarehouseItems(warehouse.items.map((entry) => buildOverviewItem(entry)))
}

export function buildRemotePluginWarehouseMachineItems(
  input: MachineViewInput
): RemotePluginWarehouseMachineItem[] {
  const remoteByName = new Map(input.remotePlugins.map((plugin) => [plugin.name, plugin]))
  const savedConfigNames = new Set(
    input.savedConfigs
      .filter((config) => config.machineId === input.machine.id)
      .map((config) => config.pluginName)
  )

  const items = input.warehouse.items.map((entry) => {
    const eligibility = getRemoteDistributionEligibility(
      {
        name: entry.pluginName,
        version: entry.version,
        platform: entry.platform,
        tags: entry.tags,
        remoteSync: entry.remoteSync,
        runtimeModel: entry.runtimeModel,
        remote: entry.remote
      },
      input.machine
    )
    const remoteStatus = remoteByName.get(entry.pluginName)
    const hasSavedConfig = savedConfigNames.has(entry.pluginName)

    return {
      ...buildOverviewItem(entry),
      eligible: eligibility.eligible,
      ...(eligibility.eligible ? {} : { ineligibilityReason: eligibility.reason }),
      ...(remoteStatus ? { remoteStatus } : {}),
      hasSavedConfig,
      pendingActions: eligibility.eligible
        ? buildPendingActions(entry, remoteStatus, hasSavedConfig)
        : []
    }
  })

  return sortWarehouseItems(items)
}
