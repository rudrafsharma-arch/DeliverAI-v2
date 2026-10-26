const fs = require('fs');
const path = require('path');
const logger = require('../observability/logger');

const MCP_URL = 'https://sso.mcp.btp.cloud.sap/mcp';
const TOKEN_FILE = path.join(process.env.DATA_DIR || './data', 'btp_tokens.json');

// Cache auth status for 5 minutes to avoid repeated token checks
let authCache = { valid: false, checkedAt: 0 };
const AUTH_CACHE_TTL = 5 * 60 * 1000;

async function getValidToken() {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('BTP not authenticated. Run auth setup first.');
  const stored = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const auth = stored.auth;
  if (!auth) throw new Error('No BTP auth tokens found.');

  const issuedAt = auth.issued_at || 0;
  const expiresIn = auth.expires_in || 1800;
  // 5 minute buffer before expiry
  const expiresAt = issuedAt + (expiresIn * 1000) - (5 * 60 * 1000);

  if (issuedAt > 0 && Date.now() < expiresAt) {
    // Token still valid - use it silently
    return auth.access_token;
  }

  // Token expired - attempt refresh
  if (!auth.refresh_token) throw new Error('BTP token expired. Please re-authenticate via test_mcp.mjs.');
  logger.info('BTP access token expired - refreshing...', { category: 'btp-connector' });

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refresh_token,
    client_id: 'e789ba01-5612-47ee-bfe7-79e26411c1ca'
  });

  const r = await fetch('https://accounts.sap.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!r.ok) throw new Error(`Token refresh failed: ${await r.text()}`);

  const newAuth = await r.json();
  newAuth.issued_at = Date.now();
  stored.auth = newAuth;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(stored, null, 2));
  logger.info('BTP token refreshed successfully', { category: 'btp-connector' });
  authCache = { valid: true, checkedAt: Date.now() };
  return newAuth.access_token;
}

async function callTool(toolName, args) {
  const token = await getValidToken();
  logger.info(`BTP tool: ${toolName}`, { category: 'btp-connector', metadata: { tool: toolName } });
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } })
  });
  const text = await r.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const d = JSON.parse(line.replace('data: ', ''));
        const result = d.result?.content?.[0]?.text || JSON.stringify(d.result || d);
        return result;
      } catch(e) {}
    }
  }
  return null;
}

async function listTools() {
  const token = await getValidToken();
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  });
  const text = await r.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const d = JSON.parse(line.replace('data: ', ''));
        return d.result?.tools || [];
      } catch(e) {}
    }
  }
  return [];
}

async function isAuthenticated() {
  // Use cache to avoid hammering the token file
  if (Date.now() - authCache.checkedAt < AUTH_CACHE_TTL) return authCache.valid;
  try {
    await getValidToken();
    authCache = { valid: true, checkedAt: Date.now() };
    return true;
  } catch(e) {
    authCache = { valid: false, checkedAt: Date.now() };
    return false;
  }
}

module.exports = { callTool, listTools, isAuthenticated, getValidToken };