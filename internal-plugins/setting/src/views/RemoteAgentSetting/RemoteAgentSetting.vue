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
const selectedAgentId = ref('')
const selectedPluginName = ref('')
const installCommand = ref('')
const pluginConfigText = ref('{\n  \n}')

const createForm = ref({
  name: '',
  selectedLocalAddress: '',
  tagMode: 'allow_all' as 'allow_all' | 'allow_list',
  tagInput: ''
})

const selectedAgent = computed(() => {
  return agents.value.find((agent) => agent.id === selectedAgentId.value) || null
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
    selectedLocalAddress: createForm.value.selectedLocalAddress,
    tagPolicy: buildTagPolicy()
  })

  if (!result.success) {
    error(result.error || '创建远程 Agent 失败')
    return
  }

  installCommand.value = result.installCommand || ''
  createForm.value.name = ''
  createForm.value.tagInput = ''
  await loadPage()
  if (result.record?.id) {
    selectedAgentId.value = result.record.id
  }
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

  installCommand.value = result.installCommand || ''
  await loadPage()
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

  await loadSyncJobs()
  success('远程 Agent 同步完成')
}

watch(selectedAgentId, async () => {
  await loadSyncJobs()
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
  <div class="content-panel remote-agent-page">
    <div class="page-header">
      <div>
        <h2 class="section-title">远程 Agent</h2>
        <p class="section-desc">管理 Linux 远程机器、安装命令和插件同步</p>
      </div>
      <button class="btn btn-primary" @click="loadPage">刷新</button>
    </div>

    <div class="page-grid">
      <section class="left-panel card">
        <h3 class="card-title">新增机器</h3>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">机器名称</span>
            <input v-model="createForm.name" class="input" type="text" placeholder="Workshop Linux" />
          </label>

          <label class="field">
            <span class="field-label">本机发布地址</span>
            <select v-model="createForm.selectedLocalAddress" class="input">
              <option disabled value="">请选择局域网地址</option>
              <option v-for="address in localAddresses" :key="address" :value="address">
                {{ address }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">标签策略</span>
            <select v-model="createForm.tagMode" class="input">
              <option value="allow_all">全部标签</option>
              <option value="allow_list">仅允许指定标签</option>
            </select>
          </label>

          <label v-if="createForm.tagMode === 'allow_list'" class="field">
            <span class="field-label">允许标签</span>
            <input
              v-model="createForm.tagInput"
              class="input"
              type="text"
              placeholder="scp,hci"
            />
          </label>
        </div>

        <button class="btn btn-primary create-btn" @click="createAgent">生成安装命令</button>

        <h3 class="card-title machine-title">机器列表</h3>
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
              <span class="status-pill" :class="`status-${agent.status}`">{{ agent.status }}</span>
            </div>
            <div class="machine-meta">{{ agent.platform }} · {{ agent.selectedLocalAddress }}</div>
          </button>
        </div>
      </section>

      <section class="right-panel card">
        <template v-if="selectedAgent">
          <div class="detail-header">
            <div>
              <h3 class="card-title">{{ selectedAgent.name }}</h3>
              <p class="detail-meta">
                {{ selectedAgent.platform }} · {{ selectedAgent.selectedLocalAddress }}
              </p>
            </div>
            <div class="detail-actions">
              <button class="btn" @click="regenerateInstallCommand">重生成命令</button>
              <button class="btn btn-primary" @click="syncSelectedAgent">同步插件</button>
            </div>
          </div>

          <div class="install-panel">
            <span class="field-label">安装命令</span>
            <textarea
              :value="installCommand"
              class="command-box"
              rows="4"
              readonly
              placeholder="生成远程机器后会在这里显示 curl 命令"
            ></textarea>
            <button class="btn btn-primary btn-sm" @click="copyInstallCommand">复制命令</button>
          </div>

          <div class="deployable-panel">
            <div class="panel-heading">
              <h4 class="sub-title">可部署插件</h4>
              <span class="panel-count">{{ deployableRows.length }}</span>
            </div>
            <div class="plugin-list">
              <div v-for="row in deployableRows" :key="row.name" class="plugin-item">
                <div class="plugin-main">
                  <strong>{{ row.name }}</strong>
                  <span class="plugin-version">v{{ row.version }}</span>
                </div>
                <div class="plugin-tags">{{ (row.tags || []).join(', ') || '无标签' }}</div>
                <div class="plugin-state" :class="{ excluded: row.excluded }">
                  {{
                    row.excluded
                      ? row.excludedReason === 'platform'
                        ? '平台不匹配'
                        : '标签策略排除'
                      : '可部署'
                  }}
                </div>
              </div>
            </div>
          </div>

          <div class="config-panel">
            <div class="panel-heading">
              <h4 class="sub-title">单插件运行前配置</h4>
            </div>
            <select v-model="selectedPluginName" class="input">
              <option disabled value="">请选择插件</option>
              <option v-for="row in availablePlugins" :key="row.name" :value="row.name">
                {{ row.name }}
              </option>
            </select>
            <textarea v-model="pluginConfigText" class="command-box config-box" rows="8"></textarea>
            <button class="btn btn-primary btn-sm" @click="savePluginConfig">保存配置</button>
          </div>

          <div class="jobs-panel">
            <div class="panel-heading">
              <h4 class="sub-title">最近同步日志</h4>
            </div>
            <div v-if="syncJobs.length === 0" class="empty-state">暂无同步日志</div>
            <div v-else class="job-list">
              <div v-for="job in syncJobs" :key="`${job.startedAt}-${job.pluginName}-${job.action}`" class="job-item">
                <strong>{{ job.pluginName }}</strong>
                <span>{{ job.action }}</span>
                <span :class="['job-status', job.status]">{{ job.status }}</span>
                <span class="job-message">{{ job.message }}</span>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">先在左侧创建或选择一台远程机器</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.content-panel {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-color);
}

.remote-agent-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header,
.detail-header,
.panel-heading,
.machine-top,
.plugin-main,
.job-item,
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title,
.card-title,
.sub-title {
  margin: 0;
  color: var(--text-color);
}

.section-title {
  font-size: 20px;
  font-weight: 600;
}

.section-desc,
.detail-meta,
.machine-meta,
.plugin-tags,
.job-message {
  color: var(--text-secondary);
}

.section-desc,
.detail-meta {
  margin: 6px 0 0 0;
  font-size: 13px;
}

.page-grid {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 20px;
}

.card {
  border: 1px solid var(--divider-color);
  border-radius: 16px;
  padding: 18px;
  background: color-mix(in srgb, var(--bg-color) 80%, white 20%);
}

.form-grid,
.deployable-panel,
.config-panel,
.jobs-panel,
.install-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input,
.command-box {
  width: 100%;
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-color);
  box-sizing: border-box;
}

.command-box {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: vertical;
}

.machine-title {
  margin-top: 20px;
}

.machine-list,
.plugin-list,
.job-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.machine-item,
.plugin-item,
.job-item {
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.6);
  text-align: left;
}

.machine-item {
  cursor: pointer;
}

.machine-item.active {
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color, #2563eb) 50%, transparent);
}

.machine-name,
.panel-count,
.plugin-version {
  color: var(--text-color);
}

.status-pill,
.plugin-state,
.job-status {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 8px;
}

.status-pending,
.job-status.error,
.plugin-state.excluded {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.status-online,
.job-status.success {
  background: rgba(16, 185, 129, 0.16);
  color: #047857;
}

.status-offline,
.status-error {
  background: rgba(239, 68, 68, 0.16);
  color: #b91c1c;
}

.empty-state {
  color: var(--text-secondary);
  padding: 24px 0;
}

.create-btn {
  margin-top: 4px;
}

.config-box {
  min-height: 180px;
}

@media (max-width: 960px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}
</style>
