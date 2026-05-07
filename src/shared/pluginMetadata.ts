export type NormalizedPluginMetadata = {
  platform: string[]
  tags: string[]
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

export function normalizePluginMetadata(manifest: {
  platform?: unknown
  tags?: unknown
}): NormalizedPluginMetadata {
  return {
    platform: normalizeStringArray(manifest.platform),
    tags: normalizeStringArray(manifest.tags)
  }
}
