import { randomBytes, randomUUID } from 'crypto'
import databaseAPI from '../../api/shared/database'
import {
  createEmptyRemoteAgentsDoc,
  createPendingRemoteAgent
} from './store'
import {
  type DeployablePlugin,
  buildDeployablePluginList,
  buildRemoteAgentSyncPlan
} from './deployment'
import { RemoteAgentClient } from './client'
import { listLanIpv4Addresses } from './localAddressDiscovery'
import { RemoteAgentOnboardingService } from './onboardingService'
import type {
  PendingRemoteAgentRecord,
  RemoteAgentOnboardingInput,
  RemoteAgentPluginConfigRecord,
  RemoteAgentRecord,
  RemoteAgentsDoc,
  RemoteAgentSyncJobRecord,
  RemoteAgentTagPolicy
} from '../../../shared/remoteAgent'
import {
  REMOTE_AGENTS_DB_KEY,
  REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY,
  REMOTE_AGENT_SYNC_JOBS_DB_KEY
} from '../../../shared/remoteAgent'

const DEFAULT_ONBOARDING_PORT = 37121
const ONBOARDING_TTL_MS = 15 * 60 * 1000

type CreateRemoteAgentInput = {
  name: string
  platform: 'linux'
  selectedLocalAddress: string
  tagPolicy: RemoteAgentTagPolicy
}

function isRemoteAgentRecord(value: unknown): value is RemoteAgentRecord {
  return !!value && typeof value === 'object' && typeof (value as RemoteAgentRecord).id === 'string'
}

export class RemoteAgentManager {
  private onboardingService = new RemoteAgentOnboardingService(DEFAULT_ONBOARDING_PORT)

  public init(): void {}

  public async listRemoteAgents(): Promise<RemoteAgentRecord[]> {
    return this.readAgentsDoc().items
  }

  public async listRemoteAgentLocalAddresses(): Promise<string[]> {
    return listLanIpv4Addresses()
  }

  public async createRemoteAgent(
    input: CreateRemoteAgentInput
  ): Promise<{ success: boolean; record: PendingRemoteAgentRecord; installCommand: string }> {
    const onboardingInput = this.buildOnboardingInput(input)
    const nextDoc = createPendingRemoteAgent(this.readAgentsDoc(), onboardingInput)
    this.writeAgentsDoc(nextDoc)

    const record = this.requirePendingRecord(nextDoc, onboardingInput.id)
    return {
      success: true,
      record,
      installCommand: this.buildInstallCommand(record)
    }
  }

  public async regenerateRemoteAgentInstallCommand(
    machineId: string,
    selectedLocalAddress: string
  ): Promise<{ success: boolean; record?: PendingRemoteAgentRecord; installCommand?: string; error?: string }> {
    const existing = this.readAgentsDoc().items.find((item) => item.id === machineId)
    if (!existing) {
      return { success: false, error: 'Remote agent not found' }
    }

    const onboardingInput = this.buildOnboardingInput({
      name: existing.name,
      platform: existing.platform,
      selectedLocalAddress,
      tagPolicy: existing.tagPolicy
    }, machineId)

    const nextDoc = createPendingRemoteAgent(this.readAgentsDoc(), onboardingInput)
    this.writeAgentsDoc(nextDoc)

    const record = this.requirePendingRecord(nextDoc, machineId)
    return {
      success: true,
      record,
      installCommand: this.buildInstallCommand(record)
    }
  }

  public async saveRemoteAgentPluginConfig(input: {
    machineId: string
    pluginName: string
    config: Record<string, unknown>
  }): Promise<{ success: boolean }> {
    const existing = this.readPluginConfigs().filter(
      (item) => !(item.machineId === input.machineId && item.pluginName === input.pluginName)
    )
    existing.push({
      machineId: input.machineId,
      pluginName: input.pluginName,
      config: input.config,
      updatedAt: new Date().toISOString()
    })
    databaseAPI.dbPut(REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY, existing)
    return { success: true }
  }

  public async listRemoteAgentSyncJobs(machineId: string): Promise<RemoteAgentSyncJobRecord[]> {
    return this.readSyncJobs().filter((item) => item.machineId === machineId)
  }

  public async syncRemoteAgent(
    machineId: string
  ): Promise<{ success: boolean; summary?: unknown; error?: string }> {
    try {
      const machine = this.requireMachine(machineId)
      if (!machine.agentBaseUrl) {
        return { success: false, error: `Remote agent ${machine.name} has no agentBaseUrl` }
      }

      const client = new RemoteAgentClient(machine.agentBaseUrl)
      const deployable = buildDeployablePluginList(this.readInstalledPlugins(), {
        platform: machine.platform,
        tagPolicy: machine.tagPolicy
      })
      const remotePlugins = await client.listPlugins()
      const pluginConfigs = this.readPluginConfigs().filter((item) => item.machineId === machine.id)
      const plan = buildRemoteAgentSyncPlan(deployable, remotePlugins, {
        uninstallExtraneous: true
      })

      for (const plugin of plan.install) {
        await this.runSyncAction(machine.id, plugin.name, 'install', () =>
          client.installPlugin({ name: plugin.name, version: plugin.version })
        )
      }

      for (const plugin of plan.upgrade) {
        await this.runSyncAction(machine.id, plugin.name, 'upgrade', () =>
          client.installPlugin({ name: plugin.name, version: plugin.version })
        )
      }

      for (const plugin of deployable) {
        const savedConfig = pluginConfigs.find((item) => item.pluginName === plugin.name)
        if (!savedConfig) continue

        await this.runSyncAction(machine.id, plugin.name, 'configure', () =>
          client.configurePlugin({
            pluginName: plugin.name,
            config: savedConfig.config
          })
        )
        await this.runSyncAction(machine.id, plugin.name, 'restart', () =>
          client.restartPlugin({ pluginName: plugin.name })
        )
      }

      for (const plugin of plan.uninstall) {
        await this.runSyncAction(machine.id, plugin.name, 'uninstall', () =>
          client.uninstallPlugin({ pluginName: plugin.name })
        )
      }

      return { success: true, summary: plan }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Remote agent sync failed'
      }
    }
  }

  public renderInstallScript(machineId: string): string | null {
    const doc = this.readAgentsDoc()
    const record = doc.items.find((item) => item.id === machineId)
    if (!record || record.status !== 'pending') return null
    return this.onboardingService.renderInstallScript(this.requirePendingRecord(doc, machineId))
  }

  private buildInstallCommand(record: PendingRemoteAgentRecord): string {
    return `curl -fsSL http://${record.selectedLocalAddress}:${DEFAULT_ONBOARDING_PORT}/agent/install/${record.onboardingToken}.sh | sh`
  }

  private buildOnboardingInput(
    input: CreateRemoteAgentInput,
    machineId: string = randomUUID()
  ): RemoteAgentOnboardingInput {
    return {
      id: machineId,
      name: input.name,
      platform: input.platform,
      selectedLocalAddress: input.selectedLocalAddress,
      tagPolicy: input.tagPolicy,
      onboardingToken: randomBytes(16).toString('hex'),
      onboardingExpiresAt: new Date(Date.now() + ONBOARDING_TTL_MS).toISOString()
    }
  }

  private readAgentsDoc(): RemoteAgentsDoc {
    const doc = databaseAPI.dbGet(REMOTE_AGENTS_DB_KEY)
    if (!doc || typeof doc !== 'object' || !Array.isArray((doc as RemoteAgentsDoc).items)) {
      return createEmptyRemoteAgentsDoc()
    }

    return {
      items: (doc as RemoteAgentsDoc).items.filter(isRemoteAgentRecord)
    }
  }

  private writeAgentsDoc(doc: RemoteAgentsDoc): void {
    databaseAPI.dbPut(REMOTE_AGENTS_DB_KEY, doc)
  }

  private requireMachine(machineId: string): RemoteAgentRecord {
    const machine = this.readAgentsDoc().items.find((item) => item.id === machineId)
    if (!machine) {
      throw new Error('Remote agent not found')
    }
    return machine
  }

  private requirePendingRecord(doc: RemoteAgentsDoc, machineId: string): PendingRemoteAgentRecord {
    const record = doc.items.find((item) => item.id === machineId)
    if (!record || record.status !== 'pending' || !record.onboardingToken || !record.onboardingExpiresAt) {
      throw new Error('Pending remote agent record was not created correctly')
    }
    return record as PendingRemoteAgentRecord
  }

  private readPluginConfigs(): RemoteAgentPluginConfigRecord[] {
    const doc = databaseAPI.dbGet(REMOTE_AGENT_PLUGIN_CONFIGS_DB_KEY)
    return Array.isArray(doc) ? (doc as RemoteAgentPluginConfigRecord[]) : []
  }

  private readInstalledPlugins(): DeployablePlugin[] {
    const doc = databaseAPI.dbGet('plugins')
    if (!Array.isArray(doc)) return []

    return doc.filter(
      (item): item is DeployablePlugin =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as DeployablePlugin).name === 'string' &&
        typeof (item as DeployablePlugin).version === 'string'
    )
  }

  private readSyncJobs(): RemoteAgentSyncJobRecord[] {
    const doc = databaseAPI.dbGet(REMOTE_AGENT_SYNC_JOBS_DB_KEY)
    return Array.isArray(doc) ? (doc as RemoteAgentSyncJobRecord[]) : []
  }

  private writeSyncJobs(items: RemoteAgentSyncJobRecord[]): void {
    databaseAPI.dbPut(REMOTE_AGENT_SYNC_JOBS_DB_KEY, items)
  }

  private async runSyncAction(
    machineId: string,
    pluginName: string,
    action: RemoteAgentSyncJobRecord['action'],
    runner: () => Promise<unknown>
  ): Promise<void> {
    const startedAt = new Date().toISOString()
    try {
      await runner()
      this.appendSyncJob({
        machineId,
        pluginName,
        action,
        status: 'success',
        message: 'ok',
        startedAt,
        finishedAt: new Date().toISOString()
      })
    } catch (error) {
      this.appendSyncJob({
        machineId,
        pluginName,
        action,
        status: 'error',
        message: error instanceof Error ? error.message : 'unknown error',
        startedAt,
        finishedAt: new Date().toISOString()
      })
      throw error
    }
  }

  private appendSyncJob(job: RemoteAgentSyncJobRecord): void {
    const jobs = this.readSyncJobs()
    jobs.push(job)
    this.writeSyncJobs(jobs)
  }
}

export default new RemoteAgentManager()
