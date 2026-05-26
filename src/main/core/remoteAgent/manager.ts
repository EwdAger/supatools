import { randomBytes, randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import databaseAPI from '../../api/shared/database'
import {
  createEmptyRemoteAgentsDoc,
  createPendingRemoteAgent,
  markRemoteAgentOnline
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
  RemoteAgentInfo,
  PendingRemoteAgentRecord,
  RemoteAgentOnboardingInput,
  RemoteAgentPluginConfigRecord,
  RemoteAgentPluginStatus,
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
  installProfileTag?: string
  selectedLocalAddress: string
  tagPolicy: RemoteAgentTagPolicy
}

function isRemoteAgentRecord(value: unknown): value is RemoteAgentRecord {
  return !!value && typeof value === 'object' && typeof (value as RemoteAgentRecord).id === 'string'
}

export class RemoteAgentManager {
  private onboardingService = new RemoteAgentOnboardingService(DEFAULT_ONBOARDING_PORT, {
    findPendingRecordByToken: (token) => this.findPendingRecordByToken(token),
    registerRemoteAgent: async (payload) => await this.registerRemoteAgent(payload)
  })

  public init(): void {
    void this.refreshOnboardingService()
  }

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
    await this.refreshOnboardingService()

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
  ): Promise<{
    success: boolean
    record?: PendingRemoteAgentRecord
    installCommand?: string
    error?: string
  }> {
    const existing = this.readAgentsDoc().items.find((item) => item.id === machineId)
    if (!existing) {
      return { success: false, error: 'Remote agent not found' }
    }

    const onboardingInput = this.buildOnboardingInput(
      {
        name: existing.name,
        platform: existing.platform,
        installProfileTag: existing.installProfileTag,
        selectedLocalAddress,
        tagPolicy: existing.tagPolicy
      },
      machineId
    )

    const nextDoc = createPendingRemoteAgent(this.readAgentsDoc(), onboardingInput)
    this.writeAgentsDoc(nextDoc)
    await this.refreshOnboardingService()

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

  public async getRemoteAgentInfo(machineId: string): Promise<RemoteAgentInfo | null> {
    const machine = this.requireMachine(machineId)
    if (!machine.agentBaseUrl) return null

    try {
      return await new RemoteAgentClient(machine.agentBaseUrl).getInfo()
    } catch (error) {
      console.error('[RemoteAgent] 获取远端 agent 信息失败:', error)
      return null
    }
  }

  public async listRemoteAgentInstalledPlugins(
    machineId: string
  ): Promise<RemoteAgentPluginStatus[]> {
    const machine = this.requireMachine(machineId)
    if (!machine.agentBaseUrl) return []

    try {
      const client = new RemoteAgentClient(machine.agentBaseUrl)
      const plugins = await client.listPlugins()
      const savedConfigs = this.readPluginConfigs().filter((item) => item.machineId === machine.id)
      return plugins.map((plugin) => {
        const saved = savedConfigs.find((item) => item.pluginName === plugin.name)
        return {
          ...plugin,
          configStatus:
            plugin.configStatus ||
            (plugin.runtimeModel === 'static' ? 'not_required' : saved ? 'saved' : 'missing')
        }
      })
    } catch (error) {
      console.error('[RemoteAgent] 获取远端插件状态失败:', error)
      return []
    }
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
        await this.runSyncAction(machine.id, plugin.name, 'install', async () =>
          client.installPlugin({
            name: plugin.name,
            version: plugin.version,
            runtimeModel: plugin.runtimeModel,
            packageData: await this.packagePluginForRemote(plugin)
          })
        )
      }

      for (const plugin of plan.upgrade) {
        await this.runSyncAction(machine.id, plugin.name, 'upgrade', async () =>
          client.installPlugin({
            name: plugin.name,
            version: plugin.version,
            runtimeModel: plugin.runtimeModel,
            packageData: await this.packagePluginForRemote(plugin)
          })
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
    return `curl -fsSL http://${record.selectedLocalAddress}:${this.onboardingService.getPort()}/agent/install/${record.onboardingToken}.sh | sh`
  }

  private buildOnboardingInput(
    input: CreateRemoteAgentInput,
    machineId: string = randomUUID()
  ): RemoteAgentOnboardingInput {
    return {
      id: machineId,
      name: input.name,
      platform: input.platform,
      ...(input.installProfileTag ? { installProfileTag: input.installProfileTag } : {}),
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

  private findPendingRecordByToken(token: string): PendingRemoteAgentRecord | null {
    const doc = this.readAgentsDoc()
    const record = doc.items.find(
      (item) =>
        item.status === 'pending' &&
        item.onboardingToken === token &&
        item.onboardingExpiresAt &&
        new Date(item.onboardingExpiresAt).getTime() > Date.now()
    )
    if (!record) return null
    return record as PendingRemoteAgentRecord
  }

  private async registerRemoteAgent(payload: {
    token: string
    machineId: string
    agentBaseUrl: string
    agentVersion: string
    lastSeenAt: string
    agentPid?: number
    agentLogPath?: string
  }): Promise<{ success: boolean; error?: string }> {
    const doc = this.readAgentsDoc()
    const record = doc.items.find((item) => item.id === payload.machineId)
    if (
      !record ||
      record.status !== 'pending' ||
      record.onboardingToken !== payload.token ||
      !record.onboardingExpiresAt ||
      new Date(record.onboardingExpiresAt).getTime() <= Date.now()
    ) {
      return { success: false, error: 'invalid or expired onboarding token' }
    }

    const nextDoc = markRemoteAgentOnline(doc, {
      id: payload.machineId,
      agentBaseUrl: payload.agentBaseUrl,
      agentVersion: payload.agentVersion,
      lastSeenAt: payload.lastSeenAt,
      agentPid: typeof payload.agentPid === 'number' ? payload.agentPid : undefined,
      agentLogPath: typeof payload.agentLogPath === 'string' ? payload.agentLogPath : undefined
    })
    this.writeAgentsDoc(nextDoc)
    await this.refreshOnboardingService()
    return { success: true }
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
    if (
      !record ||
      record.status !== 'pending' ||
      !record.onboardingToken ||
      !record.onboardingExpiresAt
    ) {
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
        typeof (item as DeployablePlugin).version === 'string' &&
        typeof (item as { path?: string }).path === 'string'
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

  private async refreshOnboardingService(): Promise<void> {
    const hasPending = this.readAgentsDoc().items.some(
      (item) =>
        item.status === 'pending' &&
        !!item.onboardingToken &&
        !!item.onboardingExpiresAt &&
        new Date(item.onboardingExpiresAt).getTime() > Date.now()
    )

    if (hasPending) {
      await this.onboardingService.start()
      return
    }

    if (this.onboardingService.isRunning()) {
      await this.onboardingService.stop()
    }
  }

  private async packagePluginForRemote(plugin: DeployablePlugin): Promise<string> {
    const pluginPath = (plugin as { path?: string }).path
    if (!pluginPath) {
      throw new Error(`plugin ${plugin.name} has no local path`)
    }

    const { packZpx } = await import('../../utils/zpxArchive.js')
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ztools-remote-agent-'))
    const archivePath = path.join(tempDir, `${plugin.name}.zpx`)

    try {
      await packZpx(pluginPath, archivePath)
      const buffer = await fs.readFile(archivePath)
      return buffer.toString('base64')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }
}

export default new RemoteAgentManager()
