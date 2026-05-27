type WarehouseMachineRow = {
  eligible: boolean
  ineligibilityReason?: string
  pendingActions: string[]
  pluginName: string
}

export function filterVisibleWarehouseRows<T extends WarehouseMachineRow>(
  rows: T[],
  showIneligible: boolean
): T[] {
  return showIneligible ? rows : rows.filter((row) => row.eligible)
}

export function buildDefaultSelectedPluginNames<T extends WarehouseMachineRow>(
  rows: T[]
): string[] {
  return rows
    .filter((row) => row.eligible && row.pendingActions.length > 0)
    .map((row) => row.pluginName)
}

export function getIneligibilityReasonLabel(reason?: string): string {
  switch (reason) {
    case 'remote_sync_disabled':
      return '插件未声明 remoteSync'
    case 'missing_runtime_model':
      return '缺少 runtimeModel'
    case 'missing_remote_entry':
      return '缺少 remote.entry'
    case 'platform_mismatch':
      return '平台不匹配'
    case 'tag_policy_mismatch':
      return '机器标签策略不匹配'
    default:
      return '不可分发'
  }
}

export function getPendingActionLabel(actions: string[]): string {
  if (actions.length === 0) return '无待同步动作'
  return actions
    .map((action) => {
      switch (action) {
        case 'install':
          return '安装'
        case 'upgrade':
          return '升级'
        case 'configure':
          return '配置下发'
        default:
          return action
      }
    })
    .join(' / ')
}
