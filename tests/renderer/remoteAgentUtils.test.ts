import { describe, expect, it } from 'vitest'
import { buildDeployablePluginRows } from '../../internal-plugins/setting/src/views/RemoteAgentSetting/remoteAgentUtils'

describe('remoteAgentUtils', () => {
  it('marks plugins outside platform or tag policy as excluded', () => {
    const rows = buildDeployablePluginRows(
      [
        { name: 'scp-tool', version: '1.0.0', platform: ['linux'], tags: ['scp'] },
        { name: 'mac-only', version: '1.0.0', platform: ['darwin'], tags: ['scp'] }
      ],
      {
        platform: 'linux',
        tagPolicy: { mode: 'allow_list', tags: ['scp'] }
      }
    )

    expect(rows.find((row) => row.name === 'scp-tool')?.excluded).toBe(false)
    expect(rows.find((row) => row.name === 'mac-only')?.excludedReason).toBe('platform')
  })
})
