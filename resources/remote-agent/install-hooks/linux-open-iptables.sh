#!/bin/sh

# Example Linux install hook.
# Opens the agent port with iptables when iptables is available.
# This template is opt-in via the install profile tag.

if command -v iptables >/dev/null 2>&1; then
  if ! iptables -C INPUT -p tcp --dport "$AGENT_PORT" -j ACCEPT >/dev/null 2>&1; then
    iptables -I INPUT -p tcp --dport "$AGENT_PORT" -j ACCEPT
    echo "[ztools-agent hook] opened iptables for port $AGENT_PORT"
  else
    echo "[ztools-agent hook] iptables rule already present for port $AGENT_PORT"
  fi
else
  echo "[ztools-agent hook] iptables not found; skipped"
fi
