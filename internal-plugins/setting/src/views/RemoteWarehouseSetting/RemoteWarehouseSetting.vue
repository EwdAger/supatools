<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/components'
import {
  buildDefaultSelectedPluginNames,
  filterVisibleWarehouseRows,
  getIneligibilityReasonLabel,
  getPendingActionLabel
} from './remoteWarehouseUtils'

const { success, error, warning } = useToast()
const route = useRoute()
const router = useRouter()

interface AgentRecord {
  id: string
  name: string
  platform: 'linux'
  status: string
  installProfileTag?: string
}

interface WarehouseSummary {
  totalEntries: number
  updateAvailableEntries: number
  eligibleEntries?: number
  ineligibleEntries?: number
  pendingSyncEntries?: number
}

interface WarehouseOverviewItem {
  pluginName: string
  title: string
  version: string
  sourceType: string
  snapshotCreatedAt: string
  platform: string[]
  tags: string[]
  runtimeModel?: string
  hasMarketUpdate?: boolean
  latestMarketVersion?: string
}

interface WarehouseMachineItem extends WarehouseOverviewItem {
  eligible: boolean
  ineligibilityReason?: string
  remoteStatus?: {
    version: string
    configStatus?: string
    runtimeStatus?: string
    lastRunStatus?: string
    lastError?: string
  }
  hasSavedConfig: boolean
  pendingActions: string[]
}

interface WarehouseView {
  scope: 'overview' | 'machine'
  machineId?: string
  items: Array<WarehouseOverviewItem | WarehouseMachineItem>
  summary: WarehouseSummary
}

const agents = ref<AgentRecord[]>([])
const selectedMachineId = ref(
  typeof route.query.machineId === 'string' ? route.query.machineId : ''
)
const warehouseView = ref<WarehouseView>({
  scope: 'overview',
  items: [],
  summary: {
    totalEntries: 0,
    updateAvailableEntries: 0
  }
})
const selectedPluginNames = ref<string[]>([])
const showIneligible = ref(false)
const isLoading = ref(false)
const isSyncing = ref(false)

const selectedMachine = computed(
  () => agents.value.find((agent) => agent.id === selectedMachineId.value) || null
)

const machineRows = computed(() => {
  if (warehouseView.value.scope !== 'machine') return []
  return warehouseView.value.items as WarehouseMachineItem[]
})

const visibleMachineRows = computed(() =>
  filterVisibleWarehouseRows(machineRows.value, showIneligible.value)
)

const selectedCount = computed(() => selectedPluginNames.value.length)

function formatTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(', ') : '无标签'
}

function getRemoteStatusLabel(item: WarehouseMachineItem): string {
  if (!item.remoteStatus) return '远端未安装'

  const parts = [`远端 v${item.remoteStatus.version}`]
  if (item.remoteStatus.configStatus) {
    parts.push(`config: ${item.remoteStatus.configStatus}`)
  }
  if (item.remoteStatus.runtimeStatus) {
    parts.push(`runtime: ${item.remoteStatus.runtimeStatus}`)
  } else if (item.remoteStatus.lastRunStatus) {
    parts.push(`last: ${item.remoteStatus.lastRunStatus}`)
  }
  return parts.join(' · ')
}

function isRowSelectable(item: WarehouseMachineItem): boolean {
  return item.eligible && item.pendingActions.length > 0
}

function setDefaultSelection(): void {
  selectedPluginNames.value = buildDefaultSelectedPluginNames(visibleMachineRows.value)
}

function toggleSelected(pluginName: string): void {
  if (selectedPluginNames.value.includes(pluginName)) {
    selectedPluginNames.value = selectedPluginNames.value.filter((name) => name !== pluginName)
    return
  }
  selectedPluginNames.value = [...selectedPluginNames.value, pluginName]
}

function openRemoteAgentDetail(): void {
  if (!selectedMachineId.value) return
  void router.replace({
    name: 'RemoteAgents',
    query: {
      machineId: selectedMachineId.value
    }
  })
}

async function loadAgents(): Promise<void> {
  agents.value = (await window.ztools.internal.listRemoteAgents()) as AgentRecord[]
}

async function loadWarehouseView(): Promise<void> {
  isLoading.value = true
  try {
    warehouseView.value = await window.ztools.internal.getRemotePluginWarehouseView(
      selectedMachineId.value ? { machineId: selectedMachineId.value } : undefined
    )
    setDefaultSelection()
  } catch (err) {
    console.error('加载远程插件仓失败:', err)
    error('加载远程插件仓失败')
  } finally {
    isLoading.value = false
  }
}

async function refreshPage(): Promise<void> {
  await Promise.all([loadAgents(), loadWarehouseView()])
}

async function syncSelected(): Promise<void> {
  if (!selectedMachineId.value) {
    warning('请先选择远程机器')
    return
  }
  if (selectedPluginNames.value.length === 0) {
    warning('请至少选择一个待同步条目')
    return
  }

  isSyncing.value = true
  try {
    const result = await window.ztools.internal.syncRemoteAgent(
      selectedMachineId.value,
      selectedPluginNames.value
    )
    if (!result.success) {
      error(result.error || '批量同步失败')
      return
    }

    await loadWarehouseView()
    success('批量同步已完成')
  } catch (err) {
    console.error('批量同步失败:', err)
    error('批量同步失败')
  } finally {
    isSyncing.value = false
  }
}

watch(
  () => route.query.machineId,
  (machineId) => {
    const nextMachineId = typeof machineId === 'string' ? machineId : ''
    if (nextMachineId !== selectedMachineId.value) {
      selectedMachineId.value = nextMachineId
    }
  }
)

watch(selectedMachineId, async (machineId) => {
  if (machineId) {
    void router.replace({ name: 'RemoteWarehouse', query: { machineId } })
  } else if (route.name === 'RemoteWarehouse' && route.query.machineId) {
    void router.replace({ name: 'RemoteWarehouse' })
  }

  await loadWarehouseView()
})

watch(showIneligible, () => {
  setDefaultSelection()
})

onMounted(() => {
  void refreshPage()
})
</script>

<template>
  <div class="content-panel">
    <div class="scrollable-content">
      <div class="panel-header">
        <div>
          <h2 class="section-title">远程插件仓</h2>
          <p class="section-desc">统一管理仓快照，并在选定单台机器后执行批量同步</p>
        </div>
        <div class="action-row">
          <button class="btn" :disabled="isLoading" @click="refreshPage">刷新</button>
          <button
            v-if="selectedMachine"
            class="btn"
            :disabled="isLoading"
            @click="openRemoteAgentDetail"
          >
            机器详情
          </button>
        </div>
      </div>

      <div class="toolbar-card">
        <label class="toolbar-label">目标机器</label>
        <select v-model="selectedMachineId" class="input">
          <option value="">先查看仓总览</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.name }} · {{ agent.status }}
          </option>
        </select>
      </div>

      <div class="summary-row">
        <div class="summary-card">
          <span class="summary-label">仓条目</span>
          <strong class="summary-value">{{ warehouseView.summary.totalEntries }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">有新版本</span>
          <strong class="summary-value">{{ warehouseView.summary.updateAvailableEntries }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">
            {{ selectedMachine ? '待同步' : '远程机器' }}
          </span>
          <strong class="summary-value">
            {{ selectedMachine ? warehouseView.summary.pendingSyncEntries || 0 : agents.length }}
          </strong>
        </div>
        <div v-if="selectedMachine" class="summary-card">
          <span class="summary-label">可分发</span>
          <strong class="summary-value">{{ warehouseView.summary.eligibleEntries || 0 }}</strong>
        </div>
      </div>

      <div v-if="selectedMachine" class="action-toolbar">
        <button class="btn" @click="showIneligible = !showIneligible">
          {{ showIneligible ? '只看可分发条目' : '查看不可分发条目' }}
        </button>
        <button class="btn" @click="setDefaultSelection">全选待同步</button>
        <button class="btn" @click="selectedPluginNames = []">清空选择</button>
        <button class="btn btn-primary" :disabled="isSyncing" @click="syncSelected">
          批量同步 {{ selectedCount > 0 ? `(${selectedCount})` : '' }}
        </button>
      </div>

      <div class="list-panel">
        <div class="panel-heading">
          <h3 class="panel-title">
            {{ selectedMachine ? `${selectedMachine.name} 的仓条目` : '仓总览' }}
          </h3>
          <span class="panel-count">{{
            selectedMachine ? visibleMachineRows.length : warehouseView.items.length
          }}</span>
        </div>

        <div
          v-if="
            (selectedMachine && visibleMachineRows.length === 0) ||
            (!selectedMachine && warehouseView.items.length === 0)
          "
          class="empty-state"
        >
          当前没有可显示的远程仓条目
        </div>

        <div v-else class="warehouse-list">
          <template v-if="selectedMachine">
            <div
              v-for="item in visibleMachineRows"
              :key="item.pluginName"
              class="warehouse-item"
              :class="{ muted: !item.eligible }"
            >
              <div class="item-main">
                <div class="item-select">
                  <input
                    type="checkbox"
                    :checked="selectedPluginNames.includes(item.pluginName)"
                    :disabled="!isRowSelectable(item)"
                    @change="toggleSelected(item.pluginName)"
                  />
                </div>
                <div class="item-body">
                  <div class="item-top">
                    <div>
                      <strong class="item-title">{{ item.title }}</strong>
                      <span class="item-name">{{ item.pluginName }}</span>
                    </div>
                    <div class="item-badges">
                      <span class="badge">v{{ item.version }}</span>
                      <span v-if="item.runtimeModel" class="badge muted">{{
                        item.runtimeModel
                      }}</span>
                      <span v-if="item.hasMarketUpdate" class="badge warning">有新版本</span>
                    </div>
                  </div>

                  <div class="item-meta">
                    <span>{{ formatTags(item.tags) }}</span>
                    <span>平台: {{ item.platform.join(', ') || '未知' }}</span>
                    <span>来源: {{ item.sourceType }}</span>
                  </div>

                  <div class="item-status">
                    <span v-if="item.eligible" class="status-good">可分发</span>
                    <span v-else class="status-bad">
                      {{ getIneligibilityReasonLabel(item.ineligibilityReason) }}
                    </span>
                    <span>{{ getRemoteStatusLabel(item) }}</span>
                    <span>{{ getPendingActionLabel(item.pendingActions) }}</span>
                    <span v-if="item.hasSavedConfig">已有本地配置</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-for="item in warehouseView.items" :key="item.pluginName" class="warehouse-item">
              <div class="item-main">
                <div class="item-body">
                  <div class="item-top">
                    <div>
                      <strong class="item-title">{{ item.title }}</strong>
                      <span class="item-name">{{ item.pluginName }}</span>
                    </div>
                    <div class="item-badges">
                      <span class="badge">v{{ item.version }}</span>
                      <span v-if="item.runtimeModel" class="badge muted">{{
                        item.runtimeModel
                      }}</span>
                      <span v-if="item.hasMarketUpdate" class="badge warning">有新版本</span>
                    </div>
                  </div>

                  <div class="item-meta">
                    <span>{{ formatTags(item.tags) }}</span>
                    <span>平台: {{ item.platform.join(', ') || '未知' }}</span>
                    <span>来源: {{ item.sourceType }}</span>
                  </div>

                  <div class="item-status">
                    <span v-if="item.hasMarketUpdate" class="status-bad">
                      市场最新 {{ item.latestMarketVersion }}
                    </span>
                    <span v-else class="status-good">仓快照已是最新</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-panel {
  height: 100%;
  background: var(--bg-color);
}

.scrollable-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
}

.section-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.toolbar-card,
.list-panel {
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  background: var(--card-bg);
  padding: 16px;
}

.toolbar-card {
  margin-bottom: 20px;
}

.toolbar-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.summary-card {
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  background: var(--card-bg);
  padding: 14px 16px;
}

.summary-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-value {
  display: block;
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-color);
}

.action-row,
.action-toolbar,
.item-main,
.item-top,
.item-meta,
.item-status,
.panel-heading,
.item-badges {
  display: flex;
  gap: 10px;
}

.action-row,
.action-toolbar,
.panel-heading {
  align-items: center;
}

.action-row,
.panel-heading {
  justify-content: space-between;
}

.action-toolbar {
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  color: var(--text-color);
}

.panel-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.warehouse-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warehouse-item {
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  background: var(--hover-bg);
  padding: 14px;
}

.warehouse-item.muted {
  opacity: 0.72;
}

.item-main {
  align-items: flex-start;
}

.item-select {
  padding-top: 2px;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-top {
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.item-title {
  display: block;
  color: var(--text-color);
}

.item-name {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.item-meta,
.item-status {
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}

.item-status {
  margin-top: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(77, 111, 255, 0.12);
  color: var(--text-color);
  font-size: 12px;
}

.badge.muted {
  background: rgba(0, 0, 0, 0.06);
}

.badge.warning {
  background: rgba(255, 160, 0, 0.16);
}

.status-good {
  color: #248a3d;
}

.status-bad {
  color: #d93025;
}

.empty-state {
  padding: 28px 12px;
  text-align: center;
  color: var(--text-secondary);
}

.input {
  width: 100%;
}

@media (max-width: 720px) {
  .scrollable-content {
    padding: 16px;
  }

  .panel-header,
  .item-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-row {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
