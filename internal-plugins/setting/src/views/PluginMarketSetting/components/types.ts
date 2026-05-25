/** 插件市场共享类型定义 */

export interface Plugin {
  name: string
  title: string
  description: string
  iconText?: string
  iconColor?: string
  logo?: string
  version: string
  downloadUrl: string
  installed: boolean
  path?: string
  localVersion?: string
  remoteDistributionSupported?: boolean
  remoteWarehouseState?: 'unsupported' | 'not_added' | 'up_to_date' | 'update_available'
  remoteWarehouseVersion?: string
}

export interface CategoryInfo {
  key: string
  title: string
  description?: string
  icon?: string
  plugins: Plugin[]
}

export interface CategoryLayoutSection {
  type: string
  title?: string
  count?: number
  plugins?: string[]
}
