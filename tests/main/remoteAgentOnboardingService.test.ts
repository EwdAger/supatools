import { afterEach, describe, expect, it, vi } from 'vitest'
import { RemoteAgentOnboardingService } from '../../src/main/core/remoteAgent/onboardingService'
import type { PendingRemoteAgentRecord } from '../../src/shared/remoteAgent'

function makePendingRecord(overrides: Partial<PendingRemoteAgentRecord> = {}): PendingRemoteAgentRecord {
  return {
    id: 'agent-1',
    name: 'Workshop Linux',
    platform: 'linux',
    tagPolicy: { mode: 'allow_all' },
    status: 'pending',
    selectedLocalAddress: '127.0.0.1',
    onboardingToken: 'token-1',
    onboardingExpiresAt: '2099-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('RemoteAgentOnboardingService', () => {
  const runningServices: RemoteAgentOnboardingService[] = []

  afterEach(async () => {
    await Promise.all(runningServices.splice(0).map(async (service) => await service.stop()))
  })

  it('serves install scripts for pending records', async () => {
    const record = makePendingRecord()
    const service = new RemoteAgentOnboardingService(0, {
      findPendingRecordByToken: (token) => (token === 'token-1' ? record : null),
      registerRemoteAgent: vi.fn(async () => ({ success: true }))
    })
    runningServices.push(service)
    await service.start()

    const response = await fetch(
      `http://127.0.0.1:${service.getPort()}/agent/install/${record.onboardingToken}.sh`
    )

    expect(response.status).toBe(200)
    const script = await response.text()
    expect(script).toContain('Installing ZTools Linux agent...')
    expect(script).toContain('agent.py')
    expect(script).toContain(
      'export PYTHON_BIN AGENT_MACHINE_ID AGENT_TOKEN AGENT_REGISTER_URL AGENT_VERSION AGENT_PORT AGENT_ROOT REMOTE_IP AGENT_BASE_URL'
    )
    expect(script).toContain('curl -fsS -X POST "$AGENT_REGISTER_URL"')
  })

  it('forwards register requests to the manager callback', async () => {
    const registerRemoteAgent = vi.fn(async () => ({ success: true }))
    const service = new RemoteAgentOnboardingService(0, {
      findPendingRecordByToken: (token) => (token === 'token-1' ? makePendingRecord() : null),
      registerRemoteAgent
    })
    runningServices.push(service)
    await service.start()

    const response = await fetch(`http://127.0.0.1:${service.getPort()}/agent/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: 'token-1',
        machineId: 'agent-1',
        agentBaseUrl: 'http://10.0.0.5:37122',
        agentVersion: '0.1.0-bootstrap',
        lastSeenAt: '2026-05-07T08:03:00.000Z'
      })
    })

    expect(response.status).toBe(200)
    expect(registerRemoteAgent).toHaveBeenCalledWith({
      token: 'token-1',
      machineId: 'agent-1',
      agentBaseUrl: 'http://10.0.0.5:37122',
      agentVersion: '0.1.0-bootstrap',
      lastSeenAt: '2026-05-07T08:03:00.000Z'
    })
  })
})
