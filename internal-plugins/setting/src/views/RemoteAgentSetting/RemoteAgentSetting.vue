<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from '@/components'
import { buildDeployablePluginRows } from './remoteAgentUtils'

const { success, error, warning } = useToast()

type TagPolicy = { mode: 'allow_all' } | { mode: 'allow_list'; tags: string[] }

const agents = ref<any[]>([])
const plugins = ref<any[]>([])
const localAddresses = ref<string[]>([])
const syncJobs = ref<any[]>([])
const installedRemotePlugins = ref<any[]>([])
const agentInfo = ref<any | null>(null)
const selectedAgentId = ref('')
const selectedPluginName = ref('')
const installCommand = ref('')
const pluginConfigText = ref('{\n  \n}')

const createForm = ref({
  name: '',
  installProfileTag: '',
  selectedLocalAddress: '',
  tagMode: 'allow_all' as 'allow_all' | 'allow_list',
  tagInput: ''
})

const selectedAgent = computed(() => {
  return agents.value.find((agent) => agent.id === selectedAgentId.value) || null
})

const selectedAgentStatusText = computed(() => {
  if (!selectedAgent.value) return '未选择远程机器'
  const statusMap: Record<string, string> = {
    pending: '等待远程机器执行安装命令',
    onboarding: '远程 Agent 接入中',
    online: '远程 Agent 在线',
    offline: '远程 Agent 离线',
    error: '远程 Agent 异常'
  }
  return statusMap[selectedAgent.value.status] || selectedAgent.value.status
})

const deployableRows = computed(() => {
  if (!selectedAgent.value) return []
  return buildDeployablePluginRows(plugins.value, selectedAgent.value)
})

const availablePlugins = computed(() => deployableRows.value.filter((row) => !row.excluded))

function buildTagPolicy(): TagPolicy {
  if (createForm.value.tagMode === 'allow_all') {
    return { mode: 'allow_all' }
  }

  const tags = createForm.value.tagInput
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)

  return { mode: 'allow_list', tags }
}

function updateInstallCommandForSelection(): void {
  if (
    selectedAgent.value &&
    selectedAgent.value.status === 'pending' &&
    selectedAgent.value.onboardingToken &&
    selectedAgent.value.selectedLocalAddress
  ) {
    installCommand.value = `curl -fsSL http://${selectedAgent.value.selectedLocalAddress}:37121/agent/install/${selectedAgent.value.onboardingToken}.sh | sh`
    return
  }

  installCommand.value = ''
}

async function loadPage(): Promise<void> {
  try {
    const [agentList, installedPlugins, addresses] = await Promise.all([
      window.ztools.internal.listRemoteAgents(),
      window.ztools.internal.getPlugins(),
      window.ztools.internal.listRemoteAgentLocalAddresses()
    ])

    agents.value = agentList
    plugins.value = installedPlugins
    localAddresses.value = addresses

    if (!createForm.value.selectedLocalAddress && addresses.length > 0) {
      createForm.value.selectedLocalAddress = addresses[0]
    }

    if (!selectedAgentId.value && agentList.length > 0) {
      selectedAgentId.value = agentList[0].id
    }

    updateInstallCommandForSelection()
  } catch (err) {
    console.error('加载远程 Agent 页面失败:', err)
    error('加载远程 Agent 页面失败')
  }
}

async function loadSyncJobs(): Promise<void> {
  if (!selectedAgent.value) {
    syncJobs.value = []
    return
  }

  try {
    syncJobs.value = await window.ztools.internal.listRemoteAgentSyncJobs(selectedAgent.value.id)
  } catch (err) {
    console.error('加载同步日志失败:', err)
    syncJobs.value = []
  }
}

async function loadRemoteAgentStatus(): Promise<void> {
  if (!selectedAgent.value) {
    installedRemotePlugins.value = []
    agentInfo.value = null
    return
  }

  try {
    const [info, installedPlugins] = await Promise.all([
      window.ztools.internal.getRemoteAgentInfo(selectedAgent.value.id),
      window.ztools.internal.listRemoteAgentInstalledPlugins(selectedAgent.value.id)
    ])
    agentInfo.value = info
    installedRemotePlugins.value = installedPlugins
  } catch (err) {
    console.error('加载远端机器状态失败:', err)
    installedRemotePlugins.value = []
    agentInfo.value = null
  }
}

async function createAgent(): Promise<void> {
  if (!createForm.value.name.trim()) {
    warning('请填写机器名称')
    return
  }

  if (!createForm.value.selectedLocalAddress) {
    warning('请选择本机发布地址')
    return
  }

  const result = await window.ztools.internal.createRemoteAgent({
    name: createForm.value.name.trim(),
    platform: 'linux',
    ...(createForm.value.installProfileTag
      ? { installProfileTag: createForm.value.installProfileTag }
      : {}),
    selectedLocalAddress: createForm.value.selectedLocalAddress,
    tagPolicy: buildTagPolicy()
  })

  if (!result.success) {
    error(result.error || '创建远程 Agent 失败')
    return
  }

  createForm.value.name = ''
  createForm.value.installProfileTag = ''
  createForm.value.tagInput = ''
  await loadPage()
  if (result.record?.id) {
    selectedAgentId.value = result.record.id
  }
  updateInstallCommandForSelection()
  success('安装命令已生成')
}

async function regenerateInstallCommand(): Promise<void> {
  if (!selectedAgent.value) return

  const result = await window.ztools.internal.regenerateRemoteAgentInstallCommand(
    selectedAgent.value.id,
    selectedAgent.value.selectedLocalAddress
  )

  if (!result.success) {
    error(result.error || '重新生成安装命令失败')
    return
  }

  await loadPage()
  updateInstallCommandForSelection()
  success('安装命令已重新生成')
}

async function copyInstallCommand(): Promise<void> {
  if (!installCommand.value) return
  try {
    await navigator.clipboard.writeText(installCommand.value)
    success('安装命令已复制')
  } catch {
    error('复制失败')
  }
}

async function savePluginConfig(): Promise<void> {
  if (!selectedAgent.value || !selectedPluginName.value) {
    warning('请选择远程机器和插件')
    return
  }

  let parsedConfig: Record<string, unknown>
  try {
    parsedConfig = JSON.parse(pluginConfigText.value)
  } catch {
    error('插件配置必须是合法 JSON')
    return
  }

  const result = await window.ztools.internal.saveRemoteAgentPluginConfig({
    machineId: selectedAgent.value.id,
    pluginName: selectedPluginName.value,
    config: parsedConfig
  })

  if (!result.success) {
    error(result.error || '保存插件配置失败')
    return
  }

  success('运行前配置已保存')
}

async function syncSelectedAgent(): Promise<void> {
  if (!selectedAgent.value) return

  const result = await window.ztools.internal.syncRemoteAgent(selectedAgent.value.id)
  if (!result.success) {
    error(result.error || '远程 Agent 同步失败')
    return
  }

  await Promise.all([loadSyncJobs(), loadRemoteAgentStatus()])
  success('远程 Agent 同步完成')
}

watch(selectedAgentId, async () => {
  updateInstallCommandForSelection()
  await Promise.all([loadSyncJobs(), loadRemoteAgentStatus()])
  selectedPluginName.value = availablePlugins.value[0]?.name || ''
})

watch(
  availablePlugins,
  (rows) => {
    if (!rows.some((row) => row.name === selectedPluginName.value)) {
      selectedPluginName.value = rows[0]?.name || ''
    }
  },
  { immediate: true }
)

onMounted(() => {
  void loadPage()
})
</script>

<template>
  <div class="content-panel">
    <h2 class="section-title">远程 Agent</h2>
    <p class="section-desc">管理 Linux 远程机器、安装命令和插件同步</p>

    <div class="page-grid">
      <div class="left-column">
        <div class="service-config">
          <div class="setting-item vertical">
            <label class="setting-label">
              <span>机器名称</span>
              <span class="setting-desc">用于区分不同 Linux 远程机器</span>
            </label>
            <input
              v-model="createForm.name"
              class="input"
              type="text"
              placeholder="Workshop Linux"
            />
          </div>

          <div class="setting-item vertical">
            <label class="setting-label">
              <span>本机发布地址</span>
              <span class="setting-desc">远程机器需要能访问这个局域网地址</span>
            </label>
            <select v-model="createForm.selectedLocalAddress" class="input">
              <option disabled value="">请选择局域网地址</option>
              <option v-for="address in localAddresses" :key="address" :value="address">
                {{ address }}
              </option>
            </select>
          </div>

          <div class="setting-item vertical">
            <label class="setting-label">
              <span>安装平台标签</span>
              <span class="setting-desc"
                >用于选择 agent 安装后置脚本模板，例如 `linux-default` 或
                `linux-open-iptables`</span
              >
            </label>
            <select v-model="createForm.installProfileTag" class="input">
              <option value="">无后置脚本</option>
              <option value="linux-default">linux-default</option>
              <option value="linux-open-iptables">linux-open-iptables</option>
            </select>
          </div>

          <div class="setting-item vertical">
            <label class="setting-label">
              <span>标签策略</span>
              <span class="setting-desc">控制这台机器可接收哪些插件标签</span>
            </label>
            <select v-model="createForm.tagMode" class="input">
              <option value="allow_all">全部标签</option>
              <option value="allow_list">仅允许指定标签</option>
            </select>
          </div>

          <div v-if="createForm.tagMode === 'allow_list'" class="setting-item vertical">
            <label class="setting-label">
              <span>允许标签</span>
              <span class="setting-desc">使用逗号分隔，例如 `scp,hci`</span>
            </label>
            <input v-model="createForm.tagInput" class="input" type="text" placeholder="scp,hci" />
          </div>

          <button class="btn btn-primary create-btn" @click="createAgent">生成安装命令</button>
        </div>

        <div class="machine-panel">
          <h3 class="panel-title">机器列表</h3>
          <div class="machine-list">
            <button
              v-for="agent in agents"
              :key="agent.id"
              class="machine-item"
              :class="{ active: agent.id === selectedAgentId }"
              @click="selectedAgentId = agent.id"
            >
              <div class="machine-top">
                <span class="machine-name">{{ agent.name }}</span>
                <span class="status-pill" :class="`status-${agent.status}`">{{
                  agent.status
                }}</span>
              </div>
              <div class="machine-meta">
                {{ agent.platform }} · {{ agent.selectedLocalAddress }}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="right-column">
        <template v-if="selectedAgent">
          <div class="status-bar">
            <span class="status-dot" :class="{ active: selectedAgent.status === 'online' }"></span>
            <span class="status-text">
              {{ selectedAgentStatusText }}
              <template v-if="agentInfo?.pid"> · PID {{ agentInfo.pid }}</template>
              <template v-if="agentInfo?.agentVersion"> · v{{ agentInfo.agentVersion }}</template>
            </span>
          </div>

          <div class="service-config">
            <div class="setting-item vertical">
              <label class="setting-label">
                <span>安装命令</span>
                <span class="setting-desc">在远程 Linux 机器执行这条命令完成接入</span>
              </label>
              <textarea
                :value="installCommand"
                class="command-box"
                rows="5"
                readonly
                placeholder="生成远程机器后会在这里显示 curl 命令"
              ></textarea>
              <div class="action-row">
                <button class="btn" @click="regenerateInstallCommand">重生成命令</button>
                <button class="btn btn-primary btn-sm" @click="copyInstallCommand">复制命令</button>
              </div>
            </div>

            <div class="setting-item vertical">
              <label class="setting-label">
                <span>单插件运行前配置</span>
                <span class="setting-desc">先保存配置，再执行远程同步</span>
              </label>
              <select v-model="selectedPluginName" class="input">
                <option disabled value="">请选择插件</option>
                <option v-for="row in availablePlugins" :key="row.name" :value="row.name">
                  {{ row.name }}
                </option>
              </select>
              <textarea
                v-model="pluginConfigText"
                class="command-box config-box"
                rows="8"
              ></textarea>
              <div class="action-row">
                <button class="btn btn-primary btn-sm" @click="savePluginConfig">保存配置</button>
                <button class="btn btn-primary" @click="syncSelectedAgent">同步插件</button>
              </div>
            </div>
          </div>

          <div class="api-docs">
            <div class="panel-heading">
              <h3 class="docs-title">远端已安装插件</h3>
              <span class="panel-count">{{ installedRemotePlugins.length }}</span>
            </div>
            <div v-if="installedRemotePlugins.length === 0" class="empty-state">
              暂无远端已安装插件
            </div>
            <div v-else class="plugin-list">
              <div v-for="row in installedRemotePlugins" :key="row.name" class="plugin-item">
                <div class="plugin-main">
                  <strong>{{ row.name }}</strong>
                  <span class="plugin-version">v{{ row.version }}</span>
                </div>
                <div class="plugin-tags">
                  {{ row.runtimeModel || 'unknown' }}
                  <template v-if="row.configStatus"> · config: {{ row.configStatus }}</template>
                </div>
                <div class="plugin-state">
                  {{ row.runtimeStatus || row.lastRunStatus || row.lastError || '已安装' }}
                </div>
              </div>
            </div>
          </div>

          <div class="api-docs">
            <div class="panel-heading">
              <h3 class="docs-title">最近同步日志</h3>
            </div>
            <div v-if="syncJobs.length === 0" class="empty-state">暂无同步日志</div>
            <div v-else class="job-list">
              <div
                v-for="job in syncJobs"
                :key="`${job.startedAt}-${job.pluginName}-${job.action}`"
                class="job-item"
              >
                <strong>{{ job.pluginName }}</strong>
                <span>{{ job.action }}</span>
                <span :class="['job-status', job.status]">{{ job.status }}</span>
                <span class="job-message">{{ job.message }}</span>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">先在左侧创建或选择一台远程机器</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-panel {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  background: var(--bg-color);
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
}

.page-grid {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 24px;
}

.left-column,
.right-column {
  min-width: 0;
}

.service-config {
  padding-top: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.setting-item.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.input,
.command-box {
  width: 100%;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  padding: 10px 12px;
  box-sizing: border-box;
  background: var(--card-bg);
  color: var(--text-color);
}

.command-box {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  resize: vertical;
}

.create-btn {
  margin-top: 8px;
}

.machine-panel {
  margin-top: 24px;
}

.panel-title,
.docs-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 12px 0;
}

.machine-list,
.plugin-list,
.job-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.machine-item,
.plugin-item,
.job-item {
  width: 100%;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
  background: var(--card-bg);
  text-align: left;
}

.machine-item {
  cursor: pointer;
}

.machine-item.active {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 45%, transparent);
}

.machine-top,
.plugin-main,
.panel-heading,
.job-item,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.machine-name,
.plugin-version,
.panel-count {
  color: var(--text-color);
}

.machine-meta,
.plugin-tags,
.job-message {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-pill,
.plugin-state,
.job-status {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 8px;
}

.status-pending {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.status-online,
.job-status.success {
  background: rgba(16, 185, 129, 0.16);
  color: #047857;
}

.status-offline,
.status-error,
.job-status.error,
.plugin-state.excluded {
  background: rgba(239, 68, 68, 0.16);
  color: #b91c1c;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 10px 14px;
  background: var(--hover-bg);
  border-radius: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.status-dot.active {
  background: var(--success-color, #34c759);
  box-shadow: 0 0 6px var(--success-color, #34c759);
}

.status-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.api-docs {
  margin-top: 20px;
  padding: 20px;
  background: var(--hover-bg);
  border-radius: 10px;
}

.action-row {
  width: 100%;
  justify-content: flex-end;
}

.config-box {
  min-height: 180px;
}

.empty-state {
  color: var(--text-secondary);
  padding: 24px 0;
}

@media (max-width: 960px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}
</style>
