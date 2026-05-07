import os from 'os'

export function listLanIpv4Addresses(snapshot = os.networkInterfaces()): string[] {
  const result = new Set<string>()

  for (const addresses of Object.values(snapshot)) {
    for (const entry of addresses || []) {
      if (!entry) continue
      if (entry.family !== 'IPv4') continue
      if (entry.internal) continue
      result.add(entry.address)
    }
  }

  return [...result].sort()
}
