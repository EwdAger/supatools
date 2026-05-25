import { httpGet, httpPost } from '../../utils/httpRequest'
import type { RemoteAgentInfo, RemoteAgentPluginStatus } from '../../../shared/remoteAgent'

export class RemoteAgentClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  public async getInfo(): Promise<RemoteAgentInfo> {
    return (await httpGet(`${this.baseUrl}/api/agent/info`)).data as RemoteAgentInfo
  }

  public async listPlugins(): Promise<RemoteAgentPluginStatus[]> {
    return (await httpGet(`${this.baseUrl}/api/plugins`)).data as RemoteAgentPluginStatus[]
  }

  public async installPlugin(payload: Record<string, unknown>): Promise<any> {
    return this.post('/api/plugins/install', payload)
  }

  public async configurePlugin(payload: Record<string, unknown>): Promise<any> {
    return this.post('/api/plugins/configure', payload)
  }

  public async restartPlugin(payload: Record<string, unknown>): Promise<any> {
    return this.post('/api/plugins/restart', payload)
  }

  public async uninstallPlugin(payload: Record<string, unknown>): Promise<any> {
    return this.post('/api/plugins/uninstall', payload)
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<any> {
    return (
      await httpPost(`${this.baseUrl}${path}`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    ).data
  }
}
