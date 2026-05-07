import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import type {
  PendingRemoteAgentRecord
} from '../../../shared/remoteAgent'

type RemoteAgentOnboardingServiceDeps = {
  findPendingRecordByToken: (token: string) => PendingRemoteAgentRecord | null
  registerRemoteAgent: (payload: {
    token: string
    machineId: string
    agentBaseUrl: string
    agentVersion: string
    lastSeenAt: string
  }) => Promise<{ success: boolean; error?: string }>
}

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

function parseInstallToken(url: string): string | null {
  const match = /^\/agent\/install\/([A-Za-z0-9_-]+)\.sh$/.exec(url)
  return match?.[1] || null
}

function parsePingToken(url: string): string | null {
  const match = /^\/agent\/ping\/([A-Za-z0-9_-]+)$/.exec(url)
  return match?.[1] || null
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid json body'))
      }
    })
    req.on('error', reject)
  })
}

function buildBootstrapAgentSource(): string {
  return `
import http.server
import json
import os
import socketserver
import sys
from urllib.parse import urlparse

ROOT = os.path.expanduser("~/.ztools-agent")
PLUGINS_DIR = os.path.join(ROOT, "plugins")
CONFIGS_DIR = os.path.join(ROOT, "configs")
STATE_FILE = os.path.join(ROOT, "state.json")
PORT = int(os.environ.get("AGENT_PORT", "37122"))

os.makedirs(PLUGINS_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)

def load_state():
    if not os.path.exists(STATE_FILE):
        return {"plugins": {}}
    with open(STATE_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)

class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def log_message(self, format, *args):
        return

    def do_GET(self):
        path = urlparse(self.path).path
        state = load_state()
        if path == "/api/agent/info":
            self._send(200, {
                "machineId": os.environ.get("AGENT_MACHINE_ID", ""),
                "platform": "linux",
                "agentVersion": os.environ.get("AGENT_VERSION", "0.1.0-bootstrap"),
                "status": "online"
            })
            return
        if path == "/api/plugins":
            plugins = []
            for name, meta in state.get("plugins", {}).items():
                plugins.append({
                    "name": name,
                    "version": meta.get("version", "0.0.0")
                })
            self._send(200, plugins)
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        state = load_state()
        payload = self._read_json()
        if path == "/api/plugins/install":
            name = payload.get("name")
            version = payload.get("version")
            plugin_dir = os.path.join(PLUGINS_DIR, str(name))
            os.makedirs(plugin_dir, exist_ok=True)
            package_data = payload.get("packageData")
            if isinstance(package_data, str):
                with open(os.path.join(plugin_dir, "plugin.zpx.b64"), "w", encoding="utf-8") as fh:
                    fh.write(package_data)
            state.setdefault("plugins", {})[str(name)] = {"version": version}
            save_state(state)
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/configure":
            name = payload.get("pluginName")
            with open(os.path.join(CONFIGS_DIR, f"{name}.json"), "w", encoding="utf-8") as fh:
                json.dump(payload.get("config", {}), fh, ensure_ascii=False, indent=2)
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/restart":
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/uninstall":
            name = str(payload.get("pluginName"))
            state.get("plugins", {}).pop(name, None)
            save_state(state)
            plugin_dir = os.path.join(PLUGINS_DIR, name)
            if os.path.isdir(plugin_dir):
                for root, dirs, files in os.walk(plugin_dir, topdown=False):
                    for file_name in files:
                        os.remove(os.path.join(root, file_name))
                    for dir_name in dirs:
                        os.rmdir(os.path.join(root, dir_name))
                os.rmdir(plugin_dir)
            self._send(200, {"success": True})
            return
        self._send(404, {"error": "not found"})

with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
    httpd.serve_forever()
`.trim()
}

export class RemoteAgentOnboardingService {
  private server: Server | null = null
  private activePort: number

  constructor(
    private readonly port: number,
    private readonly deps: RemoteAgentOnboardingServiceDeps = {
      findPendingRecordByToken: () => null,
      registerRemoteAgent: async () => ({ success: false, error: 'not implemented' })
    }
  ) {
    this.activePort = port
  }

  public async start(): Promise<void> {
    if (this.server?.listening) return

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, '0.0.0.0', () => {
        const address = this.server!.address()
        if (address && typeof address === 'object') {
          this.activePort = address.port
        }
        this.server!.off('error', reject)
        resolve()
      })
    })
  }

  public async stop(): Promise<void> {
    if (!this.server) return
    const server = this.server
    this.server = null
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  public isRunning(): boolean {
    return !!this.server?.listening
  }

  public getPort(): number {
    return this.activePort
  }

  public renderInstallScript(record: PendingRemoteAgentRecord): string {
    const registerUrl = `http://${record.selectedLocalAddress}:${this.activePort}/agent/register`

    return [
      '#!/bin/sh',
      'set -eu',
      '',
      'if command -v python3 >/dev/null 2>&1; then',
      '  PYTHON_BIN=python3',
      'elif command -v python >/dev/null 2>&1; then',
      '  PYTHON_BIN=python',
      'else',
      '  echo "python3 or python is required" >&2',
      '  exit 1',
      'fi',
      '',
      `AGENT_MACHINE_ID=${shellQuote(record.id)}`,
      `AGENT_TOKEN=${shellQuote(record.onboardingToken)}`,
      `AGENT_REGISTER_URL=${shellQuote(registerUrl)}`,
      'AGENT_VERSION="0.1.0-bootstrap"',
      'AGENT_PORT="${AGENT_PORT:-37122}"',
      'AGENT_ROOT="$HOME/.ztools-agent"',
      'echo "Installing ZTools Linux agent..."',
      'mkdir -p "$AGENT_ROOT"',
      'REMOTE_IP="$(hostname -I 2>/dev/null | awk \'{print $1}\')"',
      'if [ -z "$REMOTE_IP" ] && command -v ip >/dev/null 2>&1; then',
      '  REMOTE_IP="$(ip route get 1 2>/dev/null | awk \'{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}\')"',
      'fi',
      'if [ -z "$REMOTE_IP" ]; then',
      '  REMOTE_IP="127.0.0.1"',
      'fi',
      'AGENT_BASE_URL="http://${REMOTE_IP}:${AGENT_PORT}"',
      'cat > "$AGENT_ROOT/config.env" <<EOF',
      `AGENT_MACHINE_ID=${envFileQuote(record.id)}`,
      `AGENT_TOKEN=${envFileQuote(record.onboardingToken)}`,
      `AGENT_REGISTER_URL=${envFileQuote(registerUrl)}`,
      'AGENT_VERSION="0.1.0-bootstrap"',
      'EOF',
      "cat > \"$AGENT_ROOT/agent.py\" <<'PY'",
      buildBootstrapAgentSource(),
      'PY',
      'nohup "$PYTHON_BIN" "$AGENT_ROOT/agent.py" >/tmp/ztools-agent.log 2>&1 &',
      'sleep 1',
      'REGISTER_PAYLOAD="$($PYTHON_BIN - <<\'PY\'',
      'import datetime',
      'import json',
      'import os',
      'print(json.dumps({',
      '    "token": os.environ["AGENT_TOKEN"],',
      '    "machineId": os.environ["AGENT_MACHINE_ID"],',
      '    "agentBaseUrl": os.environ["AGENT_BASE_URL"],',
      '    "agentVersion": os.environ["AGENT_VERSION"],',
      '    "lastSeenAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"',
      '}))',
      'PY',
      ')"',
      'curl -fsS -X POST "$AGENT_REGISTER_URL" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d "$REGISTER_PAYLOAD"',
      'echo "Remote agent installed at $AGENT_BASE_URL"'
    ].join('\n')
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET') {
      const url = req.url || '/'
      const installToken = parseInstallToken(url)
      if (installToken) {
        const record = this.deps.findPendingRecordByToken(installToken)
        if (!record) {
          this.sendJson(res, 404, { success: false, error: 'onboarding token not found' })
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/x-shellscript; charset=utf-8'
        })
        res.end(this.renderInstallScript(record))
        return
      }

      const pingToken = parsePingToken(url)
      if (pingToken) {
        const record = this.deps.findPendingRecordByToken(pingToken)
        this.sendJson(res, record ? 200 : 404, {
          success: !!record
        })
        return
      }
    }

    if (req.method === 'POST' && req.url === '/agent/register') {
      try {
        const body = await readJsonBody(req)
        const token = typeof body.token === 'string' ? body.token : ''
        const machineId = typeof body.machineId === 'string' ? body.machineId : ''
        const agentBaseUrl = typeof body.agentBaseUrl === 'string' ? body.agentBaseUrl : ''
        const agentVersion = typeof body.agentVersion === 'string' ? body.agentVersion : ''
        const lastSeenAt =
          typeof body.lastSeenAt === 'string' && body.lastSeenAt
            ? body.lastSeenAt
            : new Date().toISOString()

        if (!token || !machineId || !agentBaseUrl || !agentVersion) {
          this.sendJson(res, 400, { success: false, error: 'invalid register payload' })
          return
        }

        const result = await this.deps.registerRemoteAgent({
          token,
          machineId,
          agentBaseUrl,
          agentVersion,
          lastSeenAt
        })
        this.sendJson(res, result.success ? 200 : 400, result)
        return
      } catch (error) {
        this.sendJson(res, 400, {
          success: false,
          error: error instanceof Error ? error.message : 'invalid register payload'
        })
        return
      }
    }

    this.sendJson(res, 404, { success: false, error: 'not found' })
  }

  private sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end(JSON.stringify(body))
  }
}
