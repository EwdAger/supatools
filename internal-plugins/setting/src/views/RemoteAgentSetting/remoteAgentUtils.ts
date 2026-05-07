type RemoteAgentMachine = {
  platform: 'linux'
  tagPolicy: { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }
}

type RemoteAgentPlugin = {
  name: string
  version: string
  platform?: string[]
  tags?: string[]
}

export function buildDeployablePluginRows(
  plugins: RemoteAgentPlugin[],
  machine: RemoteAgentMachine
): Array<
  RemoteAgentPlugin & {
    excluded: boolean
    excludedReason?: 'platform' | 'tag'
  }
> {
  return plugins.map((plugin) => {
    const platformOk = (plugin.platform || []).includes(machine.platform)
    const tagOk =
      machine.tagPolicy.mode === 'allow_all'
        ? true
        : (plugin.tags || []).some((tag) => machine.tagPolicy.tags.includes(tag))

    return {
      ...plugin,
      excluded: !(platformOk && tagOk),
      excludedReason: !platformOk ? 'platform' : !tagOk ? 'tag' : undefined
    }
  })
}
