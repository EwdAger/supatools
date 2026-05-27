import type {
  RemoteAgentTagPolicy,
  RemoteDistributionIneligibilityReason
} from '../../../shared/remoteAgent'
import {
  supportsRemoteDistribution,
  type PluginRemoteMetadata,
  type PluginRuntimeModel
} from '../../../shared/pluginMetadata'

export type DeployablePlugin = {
  name: string
  version: string
  path?: string
  platform?: string[]
  tags?: string[]
  remoteSync?: boolean
  runtimeModel?: PluginRuntimeModel
  remote?: PluginRemoteMetadata
}

export type RemotePluginSnapshot = {
  name: string
  version: string
}

function matchesTagPolicy(tags: string[], policy: RemoteAgentTagPolicy): boolean {
  if (policy.mode === 'allow_all') return true
  return tags.some((tag) => policy.tags.includes(tag))
}

export function getRemoteDistributionEligibility(
  plugin: DeployablePlugin,
  machine: { platform: 'linux'; tagPolicy: RemoteAgentTagPolicy }
): { eligible: true } | { eligible: false; reason: RemoteDistributionIneligibilityReason } {
  if (!plugin.remoteSync) {
    return { eligible: false, reason: 'remote_sync_disabled' }
  }
  if (!plugin.runtimeModel) {
    return { eligible: false, reason: 'missing_runtime_model' }
  }
  if (!plugin.remote?.entry) {
    return { eligible: false, reason: 'missing_remote_entry' }
  }

  const platform = plugin.platform || []
  if (!platform.includes(machine.platform)) {
    return { eligible: false, reason: 'platform_mismatch' }
  }

  const tags = plugin.tags || []
  if (!matchesTagPolicy(tags, machine.tagPolicy)) {
    return { eligible: false, reason: 'tag_policy_mismatch' }
  }

  if (
    !supportsRemoteDistribution({
      remoteSync: plugin.remoteSync === true,
      runtimeModel: plugin.runtimeModel,
      remote: plugin.remote
    })
  ) {
    return { eligible: false, reason: 'missing_remote_entry' }
  }

  return { eligible: true }
}

export function buildDeployablePluginList(
  plugins: DeployablePlugin[],
  machine: { platform: 'linux'; tagPolicy: RemoteAgentTagPolicy }
): DeployablePlugin[] {
  return plugins.filter((plugin) => getRemoteDistributionEligibility(plugin, machine).eligible)
}

export function buildRemoteAgentSyncPlan<T extends { name: string; version: string }>(
  localPlugins: T[],
  remotePlugins: RemotePluginSnapshot[],
  options: { uninstallExtraneous: boolean }
): {
  install: T[]
  upgrade: T[]
  uninstall: RemotePluginSnapshot[]
} {
  const remoteByName = new Map(remotePlugins.map((plugin) => [plugin.name, plugin]))
  const localNames = new Set(localPlugins.map((plugin) => plugin.name))

  return {
    install: localPlugins.filter((plugin) => !remoteByName.has(plugin.name)),
    upgrade: localPlugins.filter((plugin) => {
      const remotePlugin = remoteByName.get(plugin.name)
      return !!remotePlugin && remotePlugin.version !== plugin.version
    }),
    uninstall: options.uninstallExtraneous
      ? remotePlugins.filter((plugin) => !localNames.has(plugin.name))
      : []
  }
}
