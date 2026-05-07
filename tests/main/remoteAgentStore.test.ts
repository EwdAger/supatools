import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNetworkInterfaces = vi.hoisted(() => vi.fn())

vi.mock('os', () => ({
  default: {
    networkInterfaces: mockNetworkInterfaces
  }
}))

import {
  REMOTE_AGENTS_DB_KEY,
  REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY,
  REMOTE_AGENT_SYNC_JOBS_DB_KEY
} from '../../src/shared/remoteAgent'
import { listLanIpv4Addresses } from '../../src/main/core/remoteAgent/localAddressDiscovery'
import { RemoteAgentOnboardingService } from '../../src/main/core/remoteAgent/onboardingService'
import {
  createEmptyRemoteAgentsDoc,
  createPendingRemoteAgent,
  markRemoteAgentOnline
} from '../../src/main/core/remoteAgent/store'

describe('remote agent store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNetworkInterfaces.mockReturnValue({})
  })

  it('exports the remote agent db keys and creates an empty machines doc', () => {
    expect({
      machines: REMOTE_AGENTS_DB_KEY,
      pluginConfigs: REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY,
      syncJobs: REMOTE_AGENT_SYNC_JOBS_DB_KEY
    }).toEqual({
      machines: 'settings-remote-agents',
      pluginConfigs: 'settings-remote-agent-plugin-configs',
      syncJobs: 'settings-remote-agent-sync-jobs'
    })

    expect(createEmptyRemoteAgentsDoc()).toEqual({ items: [] })
  })

  it('creates a pending remote agent with a token and selected local address', () => {
    const state = createPendingRemoteAgent(createEmptyRemoteAgentsDoc(), {
      id: 'agent-1',
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_list', tags: ['scp', 'hci'] },
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })

    expect(state.items[0]).toMatchObject({
      id: 'agent-1',
      status: 'pending',
      selectedLocalAddress: '192.168.1.23',
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })
  })

  it('marks a registered machine online and clears onboarding credentials', () => {
    const pending = createPendingRemoteAgent(createEmptyRemoteAgentsDoc(), {
      id: 'agent-1',
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_all' },
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })

    const online = markRemoteAgentOnline(pending, {
      id: 'agent-1',
      agentBaseUrl: 'http://10.0.0.5:8123',
      agentVersion: '0.1.0',
      lastSeenAt: '2026-05-07T08:03:00.000Z'
    })

    expect(online.items[0]).toMatchObject({
      id: 'agent-1',
      status: 'online',
      agentBaseUrl: 'http://10.0.0.5:8123',
      agentVersion: '0.1.0',
      lastSeenAt: '2026-05-07T08:03:00.000Z'
    })
    expect(online.items[0].onboardingToken).toBeUndefined()
    expect(online.items[0].onboardingExpiresAt).toBeUndefined()
  })

  it('lists unique lan ipv4 addresses from os network interfaces', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [
        { address: '192.168.1.23', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false }
      ],
      wlan0: [
        { address: '10.0.0.5', family: 'IPv4', internal: false },
        { address: '192.168.1.23', family: 'IPv4', internal: false }
      ]
    })

    expect(listLanIpv4Addresses()).toEqual(['10.0.0.5', '192.168.1.23'])
  })

  it('renders an install script from a pending machine record', () => {
    const service = new RemoteAgentOnboardingService(8123)
    const pending = createPendingRemoteAgent(createEmptyRemoteAgentsDoc(), {
      id: 'agent-1',
      name: 'Workshop Linux',
      platform: 'linux',
      selectedLocalAddress: '192.168.1.23',
      tagPolicy: { mode: 'allow_all' },
      onboardingToken: 'token-1',
      onboardingExpiresAt: '2026-05-07T08:15:00.000Z'
    })

    expect(service.renderInstallScript(pending.items[0])).toBe(
      [
        '#!/bin/sh',
        'set -eu',
        'AGENT_MACHINE_ID="agent-1"',
        'AGENT_TOKEN="token-1"',
        'AGENT_REGISTER_URL="http://192.168.1.23:8123/agent/register"',
        'echo "Installing ZTools Linux agent..."',
        'mkdir -p "$HOME/.ztools-agent"',
        'cat > "$HOME/.ztools-agent/config.env" <<EOF',
        'AGENT_MACHINE_ID=$AGENT_MACHINE_ID',
        'AGENT_TOKEN=$AGENT_TOKEN',
        'AGENT_REGISTER_URL=$AGENT_REGISTER_URL',
        'EOF'
      ].join('\n')
    )
  })
})
