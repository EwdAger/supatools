export type PluginRuntimeModel = 'static' | 'oneshot' | 'service'

export type PluginActionContract = {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
}

export type PluginLocalMetadata = {
  entry?: string
}

export type PluginRemoteMetadata = {
  entry?: string
  actions: Record<string, PluginActionContract>
}

export type NormalizedPluginMetadata = {
  platform: string[]
  tags: string[]
  remoteSync: boolean
  runtimeModel?: PluginRuntimeModel
  local?: PluginLocalMetadata
  remote?: PluginRemoteMetadata
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const result: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') continue

    const normalized = item.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function normalizeRuntimeModel(value: unknown): PluginRuntimeModel | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'static' || normalized === 'oneshot' || normalized === 'service') {
    return normalized
  }

  return undefined
}

function normalizeActionContracts(value: unknown): Record<string, PluginActionContract> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const result: Record<string, PluginActionContract> = {}
  for (const [actionName, rawContract] of Object.entries(value as Record<string, unknown>)) {
    const normalizedName = normalizeOptionalString(actionName)
    if (!normalizedName) continue
    if (!rawContract || typeof rawContract !== 'object' || Array.isArray(rawContract)) continue

    const contract = rawContract as Record<string, unknown>
    result[normalizedName] = {
      ...(contract.input && typeof contract.input === 'object' && !Array.isArray(contract.input)
        ? { input: contract.input as Record<string, unknown> }
        : {}),
      ...(contract.output && typeof contract.output === 'object' && !Array.isArray(contract.output)
        ? { output: contract.output as Record<string, unknown> }
        : {})
    }
  }

  return result
}

export function normalizePluginMetadata(manifest: {
  platform?: unknown
  tags?: unknown
  remoteSync?: unknown
  runtimeModel?: unknown
  local?: unknown
  remote?: unknown
  main?: unknown
}): NormalizedPluginMetadata {
  const localEntry =
    normalizeOptionalString(
      manifest.local && typeof manifest.local === 'object' && !Array.isArray(manifest.local)
        ? (manifest.local as Record<string, unknown>).entry
        : undefined
    ) ?? normalizeOptionalString(manifest.main)

  const local = localEntry ? { entry: localEntry } : undefined

  const remoteEntry =
    manifest.remote && typeof manifest.remote === 'object' && !Array.isArray(manifest.remote)
      ? normalizeOptionalString((manifest.remote as Record<string, unknown>).entry)
      : undefined

  const remoteActions =
    manifest.remote && typeof manifest.remote === 'object' && !Array.isArray(manifest.remote)
      ? normalizeActionContracts((manifest.remote as Record<string, unknown>).actions)
      : {}

  return {
    platform: normalizeStringArray(manifest.platform),
    tags: normalizeStringArray(manifest.tags),
    remoteSync: manifest.remoteSync === true,
    runtimeModel: normalizeRuntimeModel(manifest.runtimeModel),
    ...(local ? { local } : {}),
    ...(remoteEntry || Object.keys(remoteActions).length > 0
      ? {
          remote: {
            ...(remoteEntry ? { entry: remoteEntry } : {}),
            actions: remoteActions
          }
        }
      : {})
  }
}

export function supportsRemoteDistribution(
  metadata: Pick<NormalizedPluginMetadata, 'remoteSync' | 'runtimeModel' | 'remote'>
): boolean {
  return metadata.remoteSync && !!metadata.runtimeModel && !!metadata.remote?.entry
}
