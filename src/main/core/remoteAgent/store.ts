import type {
  PendingRemoteAgentRecord,
  RemoteAgentRecord,
  RemoteAgentsDoc
} from '../../../shared/remoteAgent'

export function createEmptyRemoteAgentsDoc(): RemoteAgentsDoc {
  return { items: [] }
}

export function createPendingRemoteAgent(
  doc: RemoteAgentsDoc,
  input: Omit<PendingRemoteAgentRecord, 'status'>
): RemoteAgentsDoc {
  const others = doc.items.filter((item) => item.id !== input.id)

  return {
    items: [...others, { ...input, status: 'pending' }]
  }
}

export function markRemoteAgentOnline(
  doc: RemoteAgentsDoc,
  input: Pick<RemoteAgentRecord, 'id' | 'agentBaseUrl' | 'agentVersion' | 'lastSeenAt'>
): RemoteAgentsDoc {
  return {
    items: doc.items.map((item) =>
      item.id !== input.id
        ? item
        : {
            ...item,
            status: 'online',
            onboardingToken: undefined,
            onboardingExpiresAt: undefined,
            agentBaseUrl: input.agentBaseUrl,
            agentVersion: input.agentVersion,
            lastSeenAt: input.lastSeenAt,
            lastError: undefined
          }
    )
  }
}
