import type {
  RemoteAgentOnboardingInput,
  RemoteAgentOnlineUpdate,
  RemoteAgentsDoc
} from '../../../shared/remoteAgent'

export function createEmptyRemoteAgentsDoc(): RemoteAgentsDoc {
  return { items: [] }
}

export function createPendingRemoteAgent(
  doc: RemoteAgentsDoc,
  input: RemoteAgentOnboardingInput
): RemoteAgentsDoc {
  const others = doc.items.filter((item) => item.id !== input.id)
  const { id, name, platform, selectedLocalAddress, tagPolicy, onboardingToken, onboardingExpiresAt } =
    input

  return {
    items: [
      ...others,
      {
        id,
        name,
        platform,
        selectedLocalAddress,
        tagPolicy,
        status: 'pending',
        onboardingToken,
        onboardingExpiresAt,
        agentBaseUrl: undefined,
        agentVersion: undefined,
        lastSeenAt: undefined,
        lastError: undefined
      }
    ]
  }
}

export function markRemoteAgentOnline(
  doc: RemoteAgentsDoc,
  input: RemoteAgentOnlineUpdate
): RemoteAgentsDoc {
  const { id, agentBaseUrl, agentVersion, lastSeenAt } = input

  if (!agentBaseUrl || !agentVersion || !lastSeenAt) {
    throw new Error('agentBaseUrl, agentVersion, and lastSeenAt are required')
  }

  return {
    items: doc.items.map((item) =>
      item.id !== id
        ? item
        : {
            ...item,
            status: 'online',
            onboardingToken: undefined,
            onboardingExpiresAt: undefined,
            agentBaseUrl,
            agentVersion,
            lastSeenAt,
            lastError: undefined
          }
    )
  }
}
