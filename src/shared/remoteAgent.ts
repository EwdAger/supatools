export const REMOTE_AGENTS_DB_KEY = 'settings-remote-agents'
export const REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY = 'settings-remote-agent-plugin-configs'
export const REMOTE_AGENT_SYNC_JOBS_DB_KEY = 'settings-remote-agent-sync-jobs'

export type RemoteAgentStatus = 'pending' | 'onboarding' | 'online' | 'offline' | 'error'

export type RemoteAgentTagPolicy =
  | { mode: 'allow_all' }
  | { mode: 'allow_list'; tags: string[] }

export interface RemoteAgentRecord {
  id: string
  name: string
  platform: 'linux'
  tagPolicy: RemoteAgentTagPolicy
  status: RemoteAgentStatus
  selectedLocalAddress: string
  onboardingToken?: string
  onboardingExpiresAt?: string
  agentBaseUrl?: string
  agentVersion?: string
  lastSeenAt?: string
  lastError?: string
}

export interface RemoteAgentsDoc {
  items: RemoteAgentRecord[]
}

export interface RemoteAgentPluginConfigRecord {
  machineId: string
  pluginName: string
  config: Record<string, unknown>
  updatedAt: string
}

export type RemoteAgentSyncJobAction =
  | 'install'
  | 'upgrade'
  | 'configure'
  | 'restart'
  | 'uninstall'

export type RemoteAgentSyncJobStatus = 'success' | 'error'

export interface RemoteAgentSyncJobRecord {
  machineId: string
  pluginName: string
  action: RemoteAgentSyncJobAction
  status: RemoteAgentSyncJobStatus
  message: string
  startedAt: string
  finishedAt: string
}

export interface PendingRemoteAgentRecord extends RemoteAgentRecord {
  status: 'pending'
  onboardingToken: string
  onboardingExpiresAt: string
}
