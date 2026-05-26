import fsSync from 'fs'
import path from 'path'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import type { PendingRemoteAgentRecord } from '../../../shared/remoteAgent'

type RemoteAgentOnboardingServiceDeps = {
  findPendingRecordByToken: (token: string) => PendingRemoteAgentRecord | null
  registerRemoteAgent: (payload: {
    token: string
    machineId: string
    agentBaseUrl: string
    agentVersion: string
    lastSeenAt: string
    agentPid?: number
    agentLogPath?: string
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

const INSTALL_HOOKS_DIR = path.resolve(
  __dirname,
  '../../../../resources/remote-agent/install-hooks'
)

function readInstallHookTemplate(installProfileTag?: string): string | null {
  if (!installProfileTag) return null

  const templatePath = path.join(INSTALL_HOOKS_DIR, `${installProfileTag}.sh`)
  if (!fsSync.existsSync(templatePath)) {
    return null
  }

  return fsSync.readFileSync(templatePath, 'utf-8').trim()
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
import signal
import socketserver
import sys
import time
from urllib.parse import urlparse

ROOT = os.path.expanduser("~/.ztools-agent")
PLUGINS_DIR = os.path.join(ROOT, "plugins")
CONFIGS_DIR = os.path.join(ROOT, "configs")
STATE_FILE = os.path.join(ROOT, "state.json")
RUNTIME_FILE = os.path.join(ROOT, "runtime.json")
PID_FILE = os.path.join(ROOT, "agent.pid")
LOG_FILE = os.path.join(ROOT, "agent.log")
PORT = int(os.environ.get("AGENT_PORT", "37122"))

os.makedirs(PLUGINS_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)

def write_runtime(state):
    with open(RUNTIME_FILE, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)

def load_runtime():
    if not os.path.exists(RUNTIME_FILE):
        return {}
    with open(RUNTIME_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)

def load_state():
    if not os.path.exists(STATE_FILE):
        return {"plugins": {}}
    with open(STATE_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)

def detect_runtime_model(name):
    cfg_path = os.path.join(CONFIGS_DIR, f"{name}.meta.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                value = data.get("runtimeModel")
                if value in ("static", "oneshot", "service"):
                    return value
        except Exception:
            pass
    return "service"

def plugin_status_payload(name, meta):
    runtime_model = detect_runtime_model(name)
    payload = {
        "name": name,
        "version": meta.get("version", "0.0.0"),
        "runtimeModel": runtime_model,
        "lastSyncAt": meta.get("lastSyncAt"),
        "lastError": meta.get("lastError")
    }

    config_path = os.path.join(CONFIGS_DIR, f"{name}.json")
    if runtime_model == "static":
        payload["configStatus"] = "not_required"
    else:
        payload["configStatus"] = "saved" if os.path.exists(config_path) else "missing"

    if runtime_model == "service":
        payload["runtimeStatus"] = meta.get("runtimeStatus", "running")
    elif runtime_model == "oneshot":
        payload["lastRunStatus"] = meta.get("lastRunStatus")

    return payload

with open(PID_FILE, "w", encoding="utf-8") as fh:
    fh.write(str(os.getpid()))

write_runtime({
    "pid": os.getpid(),
    "logPath": LOG_FILE,
    "agentVersion": os.environ.get("AGENT_VERSION", "0.1.0-bootstrap"),
    "machineId": os.environ.get("AGENT_MACHINE_ID", ""),
    "startedAt": int(time.time())
})

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
            runtime = load_runtime()
            self._send(200, {
                "machineId": os.environ.get("AGENT_MACHINE_ID", ""),
                "platform": "linux",
                "agentVersion": os.environ.get("AGENT_VERSION", "0.1.0-bootstrap"),
                "status": "online",
                "pid": runtime.get("pid"),
                "logPath": runtime.get("logPath")
            })
            return
        if path == "/api/plugins":
            plugins = [plugin_status_payload(name, meta) for name, meta in state.get("plugins", {}).items()]
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
            runtime_model = payload.get("runtimeModel")
            plugin_dir = os.path.join(PLUGINS_DIR, str(name))
            os.makedirs(plugin_dir, exist_ok=True)
            package_data = payload.get("packageData")
            if isinstance(package_data, str):
                with open(os.path.join(plugin_dir, "plugin.zpx.b64"), "w", encoding="utf-8") as fh:
                    fh.write(package_data)
            with open(os.path.join(CONFIGS_DIR, f"{name}.meta.json"), "w", encoding="utf-8") as fh:
                json.dump({
                    "runtimeModel": runtime_model if runtime_model in ("static", "oneshot", "service") else "service"
                }, fh, ensure_ascii=False, indent=2)
            state.setdefault("plugins", {})[str(name)] = {
                "version": version,
                "lastSyncAt": int(time.time()),
                "runtimeStatus": "running" if runtime_model == "service" else None
            }
            save_state(state)
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/configure":
            name = payload.get("pluginName")
            with open(os.path.join(CONFIGS_DIR, f"{name}.json"), "w", encoding="utf-8") as fh:
                json.dump(payload.get("config", {}), fh, ensure_ascii=False, indent=2)
            state.setdefault("plugins", {}).setdefault(str(name), {})["lastSyncAt"] = int(time.time())
            save_state(state)
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/restart":
            name = str(payload.get("pluginName"))
            plugin = state.setdefault("plugins", {}).setdefault(name, {})
            plugin["runtimeStatus"] = "running"
            plugin["lastSyncAt"] = int(time.time())
            save_state(state)
            self._send(200, {"success": True})
            return
        if path == "/api/plugins/uninstall":
            name = str(payload.get("pluginName"))
            state.get("plugins", {}).pop(name, None)
            save_state(state)
            meta_path = os.path.join(CONFIGS_DIR, f"{name}.meta.json")
            if os.path.exists(meta_path):
                os.remove(meta_path)
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
    const installHookTemplate = readInstallHookTemplate(record.installProfileTag)

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
      'AGENT_LOG="$AGENT_ROOT/agent.log"',
      'AGENT_PID_FILE="$AGENT_ROOT/agent.pid"',
      'AGENT_SERVICE_NAME="ztools-agent"',
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
      'export PYTHON_BIN AGENT_MACHINE_ID AGENT_TOKEN AGENT_REGISTER_URL AGENT_VERSION AGENT_PORT AGENT_ROOT REMOTE_IP AGENT_BASE_URL',
      'cat > "$AGENT_ROOT/config.env" <<EOF',
      `AGENT_MACHINE_ID=${envFileQuote(record.id)}`,
      `AGENT_TOKEN=${envFileQuote(record.onboardingToken)}`,
      `AGENT_REGISTER_URL=${envFileQuote(registerUrl)}`,
      'AGENT_VERSION="0.1.0-bootstrap"',
      'AGENT_LOG="$HOME/.ztools-agent/agent.log"',
      'AGENT_PID_FILE="$HOME/.ztools-agent/agent.pid"',
      `AGENT_INSTALL_PROFILE_TAG=${envFileQuote(record.installProfileTag || '')}`,
      'EOF',
      'cat > "$AGENT_ROOT/agent.py" <<\'PY\'',
      buildBootstrapAgentSource(),
      'PY',
      'cat > "$AGENT_ROOT/start-agent.sh" <<\'SH\'',
      '#!/bin/sh',
      'exec "$PYTHON_BIN" "$AGENT_ROOT/agent.py" >>"$AGENT_LOG" 2>&1',
      'SH',
      'chmod +x "$AGENT_ROOT/start-agent.sh"',
      ...(installHookTemplate
        ? [
            'cat > "$AGENT_ROOT/install-hook.sh" <<\'HOOK\'',
            installHookTemplate,
            'HOOK',
            'chmod +x "$AGENT_ROOT/install-hook.sh"',
            '"$AGENT_ROOT/install-hook.sh"'
          ]
        : []),
      'if command -v systemctl >/dev/null 2>&1; then',
      '  cat > "$AGENT_ROOT/${AGENT_SERVICE_NAME}.service" <<EOF',
      '[Unit]',
      'Description=ZTools Remote Agent',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'WorkingDirectory=$AGENT_ROOT',
      'EnvironmentFile=$AGENT_ROOT/config.env',
      'ExecStart=$AGENT_ROOT/start-agent.sh',
      'Restart=always',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '  if [ "$(id -u)" -eq 0 ]; then',
      '    install -m 0644 "$AGENT_ROOT/${AGENT_SERVICE_NAME}.service" "/etc/systemd/system/${AGENT_SERVICE_NAME}.service"',
      '    systemctl daemon-reload',
      '    systemctl enable --now "${AGENT_SERVICE_NAME}.service"',
      '  else',
      '    mkdir -p "$HOME/.config/systemd/user"',
      '    install -m 0644 "$AGENT_ROOT/${AGENT_SERVICE_NAME}.service" "$HOME/.config/systemd/user/${AGENT_SERVICE_NAME}.service"',
      '    systemctl --user daemon-reload',
      '    systemctl --user enable --now "${AGENT_SERVICE_NAME}.service"',
      '  fi',
      'else',
      '  nohup "$AGENT_ROOT/start-agent.sh" &',
      'fi',
      'sleep 1',
      "REGISTER_PAYLOAD=\"$($PYTHON_BIN - <<'PY'",
      'import datetime',
      'import json',
      'import os',
      'pid = None',
      'pid_file = os.environ.get("AGENT_PID_FILE")',
      'if pid_file and os.path.exists(pid_file):',
      '    try:',
      '        with open(pid_file, "r", encoding="utf-8") as fh:',
      '            pid = int(fh.read().strip())',
      '    except Exception:',
      '        pid = None',
      'print(json.dumps({',
      '    "token": os.environ["AGENT_TOKEN"],',
      '    "machineId": os.environ["AGENT_MACHINE_ID"],',
      '    "agentBaseUrl": os.environ["AGENT_BASE_URL"],',
      '    "agentVersion": os.environ["AGENT_VERSION"],',
      '    "agentPid": pid,',
      '    "agentLogPath": os.environ.get("AGENT_LOG"),',
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
        const agentPid =
          typeof body.agentPid === 'number' && Number.isFinite(body.agentPid)
            ? body.agentPid
            : undefined
        const agentLogPath =
          typeof body.agentLogPath === 'string' && body.agentLogPath ? body.agentLogPath : undefined

        if (!token || !machineId || !agentBaseUrl || !agentVersion) {
          this.sendJson(res, 400, { success: false, error: 'invalid register payload' })
          return
        }

        const result = await this.deps.registerRemoteAgent({
          token,
          machineId,
          agentBaseUrl,
          agentVersion,
          lastSeenAt,
          agentPid,
          agentLogPath
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
