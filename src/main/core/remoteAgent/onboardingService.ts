import type { PendingRemoteAgentRecord } from '../../../shared/remoteAgent'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
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
      'AGENT_MACHINE_ID=$AGENT_MACHINE_ID',
      'AGENT_TOKEN=$AGENT_TOKEN',
      'AGENT_REGISTER_URL=$AGENT_REGISTER_URL',
      'EOF'
    ].join('\n')
  }
}
