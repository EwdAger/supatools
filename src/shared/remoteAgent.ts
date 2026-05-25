export const REMOTE_AGENTS_DB_KEY = 'settings-remote-agents'
export const REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY = 'settings-remote-agent-plugin-configs'
export const REMOTE_AGENT_SYNC_JOBS_DB_KEY = 'settings-remote-agent-sync-jobs'

export type RemoteAgentStatus = 'pending' | 'onboarding' | 'online' | 'offline' | 'error'

export type RemoteAgentTagPolicy = { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }

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
  agentPid?: number
  agentLogPath?: string
}

export interface RemoteAgentsDoc {
  items: RemoteAgentRecord[]
}

export interface RemoteAgentOnboardingInput {
  id: string
  name: string
  platform: 'linux'
  selectedLocalAddress: string
  tagPolicy: RemoteAgentTagPolicy
  onboardingToken: string
  onboardingExpiresAt: string
}

export interface RemoteAgentOnlineUpdate {
  id: string
  agentBaseUrl: string
  agentVersion: string
  lastSeenAt: string
  agentPid?: number
  agentLogPath?: string
}

export interface RemoteAgentPluginConfigRecord {
  machineId: string
  pluginName: string
  config: Record<string, unknown>
  updatedAt: string
}

export type RemoteAgentRuntimeModel = 'static' | 'oneshot' | 'service'

export interface RemoteAgentPluginStatus {
  name: string
  version: string
  runtimeModel: RemoteAgentRuntimeModel
  configStatus?: 'saved' | 'missing' | 'not_required'
  lastSyncAt?: string
  lastError?: string
  runtimeStatus?: 'running' | 'stopped' | 'failed'
  lastRunStatus?: 'success' | 'error'
}

export interface RemoteAgentInfo {
  machineId: string
  platform: 'linux'
  agentVersion: string
  status: 'online'
  pid?: number
  logPath?: string
}

export type RemoteAgentSyncJobAction = 'install' | 'upgrade' | 'configure' | 'restart' | 'uninstall'

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
