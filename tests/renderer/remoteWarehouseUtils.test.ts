import { describe, expect, it } from 'vitest'
import {
  buildDefaultSelectedPluginNames,
  filterVisibleWarehouseRows,
  getIneligibilityReasonLabel,
  getPendingActionLabel
} from '../../internal-plugins/setting/src/views/RemoteWarehouseSetting/remoteWarehouseUtils'

describe('remoteWarehouseUtils', () => {
  const rows = [
    {
      pluginName: 'mysql-helper',
      eligible: true,
      pendingActions: ['upgrade', 'configure']
    },
    {
      pluginName: 'desktop-only',
      eligible: false,
      ineligibilityReason: 'platform_mismatch',
      pendingActions: []
    }
  ]

  it('hides ineligible rows by default', () => {
    expect(filterVisibleWarehouseRows(rows, false).map((row) => row.pluginName)).toEqual([
      'mysql-helper'
    ])
    expect(filterVisibleWarehouseRows(rows, true).map((row) => row.pluginName)).toEqual([
      'mysql-helper',
      'desktop-only'
    ])
  })

  it('preselects only eligible rows with pending actions', () => {
    expect(buildDefaultSelectedPluginNames(rows)).toEqual(['mysql-helper'])
  })

  it('formats reason and action labels', () => {
    expect(getIneligibilityReasonLabel('platform_mismatch')).toBe('平台不匹配')
    expect(getPendingActionLabel(['upgrade', 'configure'])).toBe('升级 / 配置下发')
  })
})
