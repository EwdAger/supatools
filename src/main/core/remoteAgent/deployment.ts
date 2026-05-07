import type { RemoteAgentTagPolicy } from '../../../shared/remoteAgent'

export type DeployablePlugin = {
  name: string
  version: string
  path?: string
  platform?: string[]
  tags?: string[]
}

export type RemotePluginSnapshot = {
  name: string
  version: string
}

function matchesTagPolicy(tags: string[], policy: RemoteAgentTagPolicy): boolean {
  if (policy.mode === 'allow_all') return true
  return tags.some((tag) => policy.tags.includes(tag))
}

export function buildDeployablePluginList(
  plugins: DeployablePlugin[],
  machine: { platform: 'linux'; tagPolicy: RemoteAgentTagPolicy }
): DeployablePlugin[] {
  return plugins.filter((plugin) => {
    const platform = plugin.platform || []
    const tags = plugin.tags || []
    return platform.includes(machine.platform) && matchesTagPolicy(tags, machine.tagPolicy)
  })
}

export function buildRemoteAgentSyncPlan(
  localPlugins: DeployablePlugin[],
  remotePlugins: RemotePluginSnapshot[],
  options: { uninstallExtraneous: boolean }
): {
  install: DeployablePlugin[]
  upgrade: DeployablePlugin[]
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
