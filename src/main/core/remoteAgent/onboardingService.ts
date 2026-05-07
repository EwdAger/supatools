import type { PendingRemoteAgentRecord } from '../../../shared/remoteAgent'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function envFileQuote(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}"`
}

export class RemoteAgentOnboardingService {
  constructor(private readonly port: number) {}

  public renderInstallScript(record: PendingRemoteAgentRecord): string {
    const installUrl = `http://${record.selectedLocalAddress}:${this.port}/agent/register`

    return [
      '#!/bin/sh',
      'set -eu',
      `AGENT_MACHINE_ID=${shellQuote(record.id)}`,
      `AGENT_TOKEN=${shellQuote(record.onboardingToken)}`,
      `AGENT_REGISTER_URL=${shellQuote(installUrl)}`,
      'echo "Installing ZTools Linux agent..."',
      'mkdir -p "$HOME/.ztools-agent"',
      'cat > "$HOME/.ztools-agent/config.env" <<EOF',
      `AGENT_MACHINE_ID=${envFileQuote(record.id)}`,
      `AGENT_TOKEN=${envFileQuote(record.onboardingToken)}`,
      `AGENT_REGISTER_URL=${envFileQuote(installUrl)}`,
      'EOF'
    ].join('\n')
  }
}
