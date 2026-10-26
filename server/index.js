require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Lazy-load heavy modules after env is loaded
const db = require('./db');
const logger = require('./observability/logger');
const jobManager = require('./core/job-manager');
const architect = require('./architect');
const agentRunner = require('./agents/runner');
const { callAI, getActiveEngine, ENGINES } = require('./core/ai-engine');
const context = require('./core/context');
const btpConnector = require('./connectors/btp');

const PORT = process.env.PORT || 3005;
const DATA_DIR = process.env.DATA_DIR || './data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// â”€â”€ WebSocket broadcast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected', { category: 'websocket' });
  ws.send(JSON.stringify({ type: 'connected', engine: getActiveEngine() }));
  ws.on('close', () => logger.info('WebSocket client disconnected', { category: 'websocket' }));
});

// Broadcast job events
jobManager.emitter.on('job:update', (data) => broadcast({ type: 'job:update', ...data }));
jobManager.emitter.on('job:event', (data) => broadcast({ type: 'job:event', ...data }));
architect.architectEmitter.on('question', (data) => broadcast({ type: 'architect:question', ...data }));
architect.architectEmitter.on('answered', (data) => broadcast({ type: 'architect:answered', ...data }));

// â”€â”€ SSE helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sseSetup(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// â”€â”€ ENV Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ENV_PATH = path.join(__dirname, '../.env');
function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
  });
  return env;
}
function writeEnv(updates) {
  const existing = readEnv();
  const merged = { ...existing };
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') merged[k] = v; });
  const lines = ['# DeliverAI v2 Environment', '# Never commit this file', ''];
  Object.entries(merged).forEach(([k, v]) => lines.push(`${k}=${v}`));
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
  require('dotenv').config({ path: ENV_PATH, override: true });
}

// â”€â”€ ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: getActiveEngine(), version: '2.0.0', uptime: process.uptime() });
});

// Settings
app.get('/api/settings', (req, res) => {
  const env = readEnv();
  const mask = (v) => v ? '***set***' : '';
  res.json({
    aiEngine: env.AI_ENGINE || 'claude-code-cli',
    engines: ENGINES,
    groqKey: mask(env.GROQ_API_KEY), groqModel: env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    geminiKey: mask(env.GEMINI_API_KEY), geminiModel: env.GEMINI_MODEL || 'gemini-3.5-flash',
    anthropicKey: mask(env.ANTHROPIC_API_KEY), anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    azureKey: mask(env.AZURE_OPENAI_KEY), azureEndpoint: env.AZURE_OPENAI_ENDPOINT || '', azureDeployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    gitBashPath: env.GIT_BASH_PATH || '', claudePath: env.CLAUDE_PATH || '',
    concurrency: env.CONCURRENCY || '10', confidenceThreshold: env.CONFIDENCE_THRESHOLD || '80',
    logLevel: env.LOG_LEVEL || 'info', btpGlobalAccount: env.BTP_GLOBAL_ACCOUNT||'', btpSubaccountId: env.BTP_SUBACCOUNT_ID||'', btpUser: env.BTP_USER||'', dataDir: env.DATA_DIR || './data'
  });
});

app.post('/api/settings', (req, res) => {
  const updates = {};
  const body = req.body;
  if (body.aiEngine) updates.AI_ENGINE = body.aiEngine;
  if (body.groqKey && body.groqKey !== '***set***') updates.GROQ_API_KEY = body.groqKey;
  if (body.groqModel) updates.GROQ_MODEL = body.groqModel;
  if (body.geminiKey && body.geminiKey !== '***set***') updates.GEMINI_API_KEY = body.geminiKey;
  if (body.geminiModel) updates.GEMINI_MODEL = body.geminiModel;
  if (body.anthropicKey && body.anthropicKey !== '***set***') updates.ANTHROPIC_API_KEY = body.anthropicKey;
  if (body.anthropicModel) updates.ANTHROPIC_MODEL = body.anthropicModel;
  if (body.azureKey && body.azureKey !== '***set***') updates.AZURE_OPENAI_KEY = body.azureKey;
  if (body.azureEndpoint) updates.AZURE_OPENAI_ENDPOINT = body.azureEndpoint;
  if (body.gitBashPath) updates.GIT_BASH_PATH = body.gitBashPath;
  if (body.claudePath) updates.CLAUDE_PATH = body.claudePath;
  if (body.concurrency) updates.CONCURRENCY = body.concurrency;
  if (body.confidenceThreshold) updates.CONFIDENCE_THRESHOLD = body.confidenceThreshold;
  if (body.logLevel) updates.LOG_LEVEL = body.logLevel;
  if (body.btpGlobalAccount) updates.BTP_GLOBAL_ACCOUNT = body.btpGlobalAccount;
  if (body.btpSubaccountId) updates.BTP_SUBACCOUNT_ID = body.btpSubaccountId;
  if (body.btpUser) updates.BTP_USER = body.btpUser;
  writeEnv(updates);
  res.json({ success: true });
});

app.post('/api/settings/test', async (req, res) => {
  const { engine } = req.body;
  const env = readEnv();
  try {
    if (engine === 'claude-code-cli') return res.json({ success: true, message: 'Claude Code CLI configured' });
    if (engine === 'groq') {
      const key = req.body.key && req.body.key !== '***set***' ? req.body.key : env.GROQ_API_KEY;
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify({ model: env.GROQ_MODEL || 'qwen/qwen3.8-27b', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }) });
      const d = await r.json();
      return res.json({ success: r.ok, message: r.ok ? 'Groq connected' : d.error?.message });
    }
    if (engine === 'gemini') {
      const key = req.body.key && req.body.key !== '***set***' ? req.body.key : env.GEMINI_API_KEY;
      const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) });
      const d = await r.json();
      return res.json({ success: r.ok, message: r.ok ? 'Gemini connected' : d.error?.message });
    }
    if (engine === 'anthropic') {
      const key = req.body.key && req.body.key !== '***set***' ? req.body.key : env.ANTHROPIC_API_KEY;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }) });
      const d = await r.json();
      return res.json({ success: r.ok, message: r.ok ? 'Anthropic connected' : d.error?.message });
    }
    res.json({ success: false, message: 'Unknown engine' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// â”€â”€ Projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/projects', (req, res) => {
  res.json(db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all());
});

app.post('/api/projects', (req, res) => {
  const id = `proj-${Date.now()}`;
  const { name, client, type, description } = req.body;
  db.prepare(`INSERT INTO projects (id, name, client, type, description) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name, client, type, description);
  const projDir = path.join(PROJECTS_DIR, id);
  if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });
  logger.info(`Project created: ${name}`, { projectId: id, category: 'projects' });
  res.json({ id, name, client, type, description });
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const documents = db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
  const jobs = jobManager.getJobs(req.params.id, { limit: 20 });
  res.json({ ...project, documents, jobs });
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// â”€â”€ Agents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/agents', (req, res) => {
  const agents = agentRunner.loadAllAgents();
  res.json(agents);
});

app.get('/api/agents/:id', (req, res) => {
  const agent = agentRunner.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent);
});

app.put('/api/agents/:id/prompt', (req, res) => {
  const { prompt } = req.body;
  const agentDir = path.join(__dirname, '../agents', req.params.id);
  const promptPath = path.join(agentDir, 'prompt.md');
  if (!fs.existsSync(agentDir)) return res.status(404).json({ error: 'Agent not found' });
  fs.writeFileSync(promptPath, prompt);
  logger.info(`Agent prompt updated: ${req.params.id}`, { agentId: req.params.id, category: 'agents' });
  res.json({ success: true });
});

// â”€â”€ Jobs / Run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/run', async (req, res) => {
  const { agentId, projectId, formData, mode } = req.body;
  const agent = agentRunner.getAgent(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const jobId = jobManager.createJob(agentId, agent.name, projectId, formData, mode || getActiveEngine() === 'claude-code-cli' ? 'cli' : 'api');
  const eventBuffer = [];
  jobManager.startJob(jobId, async (id, onEvent) => {
    return agentRunner.runAgent(agentId, formData, projectId, id, onEvent);
  });
  logger.info(`Job queued: ${jobId} for agent ${agentId}`, { jobId, projectId, agentId, category: 'jobs' });
  res.json({ jobId, status: 'queued' });
});

app.get('/api/run/:jobId/stream', (req, res) => {
  const send = sseSetup(req, res);
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);
  if (!job) { send('error', { message: 'Job not found' }); return res.end(); }
  send('status', { message: 'Connected to job stream', jobId });
  const handler = (data) => { if (data.jobId === jobId) send(data.event, data.data); };
  jobManager.emitter.on('job:event', handler);
  req.on('close', () => jobManager.emitter.off('job:event', handler));
});

app.get('/api/jobs', (req, res) => {
  const { projectId, status, limit } = req.query;
  res.json(jobManager.getJobs(projectId, { status, limit: parseInt(limit) || 100 }));
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

app.delete('/api/jobs/:id', (req, res) => {
  jobManager.cancelJob(req.params.id);
  res.json({ success: true });
});

// â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/documents', (req, res) => {
  const { projectId, agentId } = req.query;
  let query = 'SELECT * FROM documents WHERE 1=1';
  const params = [];
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  if (agentId) { query += ' AND agent_id = ?'; params.push(agentId); }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'File not found' });
  res.json({ ...doc, content: fs.readFileSync(doc.file_path, 'utf8') });
});

app.get('/api/documents/:id/open', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || !fs.existsSync(doc.file_path)) return res.status(404).send('File not found');
  res.setHeader('Content-Type', 'text/html');
  res.send(fs.readFileSync(doc.file_path, 'utf8'));
});

app.put('/api/documents/:id/approve', (req, res) => {
  const { approvedBy } = req.body;
  db.prepare("UPDATE documents SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .run(approvedBy || 'user', req.params.id);
  res.json({ success: true });
});

app.post('/api/documents/:id/refine', async (req, res) => {
  const send = sseSetup(req, res);
  const { instruction } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || !fs.existsSync(doc.file_path)) { send('error', { message: 'Document not found' }); return res.end(); }
  try {
    const current = fs.readFileSync(doc.file_path, 'utf8');
    send('status', { message: 'Refining document...' });
    const refined = await callAI(
      `Current document:\n${current}\n\nInstruction: ${instruction}\n\nRefine the document following the instruction. Return complete HTML.`,
      'You are a document editor. Refine documents based on instructions. Always return complete, valid HTML.',
      { maxTokens: 8000 }
    );
    fs.writeFileSync(doc.file_path, refined);
    send('complete', { html: refined });
    logger.info(`Document refined: ${doc.id}`, { category: 'documents' });
  } catch(e) {
    send('error', { message: e.message });
    logger.error(`Refine failed: ${e.message}`, { category: 'documents' });
  }
  res.end();
});

// â”€â”€ Architect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/architect/chat', async (req, res) => {
  const { message, projectId, history } = req.body;
  try {
    logger.info(`Architect chat: ${message.substring(0, 50)}`, { projectId, category: 'architect' });
    const response = await architect.chat(message, projectId, history || []);
    res.json({ message: response });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/architect/plan', async (req, res) => {
  const { goal, projectId } = req.body;
  try {
    const agents = agentRunner.loadAllAgents();
    const plan = await architect.planExecution(goal, projectId, agents);
    res.json({ plan });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/architect/questions', (req, res) => {
  res.json(architect.getPendingQuestions(req.query.projectId));
});

app.post('/api/architect/answer', (req, res) => {
  const { questionId, answer } = req.body;
  const ok = architect.answerHumanQuestion(questionId, answer);
  res.json({ success: ok });
});

app.post('/api/architect/create-agent', async (req, res) => {
  const { purpose, context: contextData, projectId } = req.body;
  try {
    const agent = await architect.createRuntimeAgent(purpose, contextData || {}, [], []);
    res.json({ agent });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€ BTP Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/btp/run', async (req, res) => {
  const send = sseSetup(req, res);
  const { task, projectId } = req.query;
  try {
    send('status', { message: 'Connected to SAP BTP Admin MCP' });
    send('status', { message: `Using AI engine: ${getActiveEngine()}` });
    const tools = await btpConnector.listTools();
    send('status', { message: `Loaded ${tools.length} BTP tools` });
    const env=readEnv(); const btpGlobalAccount=env.BTP_GLOBAL_ACCOUNT||'8cede957trial-ga'; const btpSubaccount=env.BTP_SUBACCOUNT_ID||'4e2eaf4b-4463-4be9-9926-7cf17e8adaba'; const btpUser=env.BTP_USER||env.BTP_EMAIL||'';
    const systemPrompt = `You are a SAP BTP Administrator. Respond with ONLY a valid JSON array of tool calls.\nEXACT tool names (use these exactly): ${tools.map(t => t.name).join(', ')}\nContext: global_account: "${btpGlobalAccount}", subaccount_id: "${btpSubaccount}", user: "${btpUser}"\nRules: Return ONLY JSON array. Each item: {"tool": "EXACT_NAME", "args": {...}, "description": "what"}. Always use global_account and subaccount_id from context. Max 5 calls.`;
    send('status', { message: 'AI analyzing instruction...' });
    const aiResponse = await callAI(task || 'List all subscriptions', systemPrompt, { maxTokens: 1000 });
    send('log', { text: `AI response: ${aiResponse.substring(0, 100)}` });
    let toolCalls = [];
    try {
      const clean = aiResponse.replace(/```json|```/g, '').trim();
      const match = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
      toolCalls = match ? JSON.parse(match[0]) : JSON.parse(clean);
    } catch(e) { send('log', { text: `Parse error: ${e.message}` }); }
    send('status', { message: `Executing ${toolCalls.length} BTP actions...` });
    const results = [];
    for (const tc of toolCalls) {
      send('action', { step: tc.tool, description: tc.description || tc.tool });
      try {
        const result = await btpConnector.callTool(tc.tool, tc.args);
        const success = !String(result).includes('INTERNAL');
        results.push({ tool: tc.tool, description: tc.description, result, success });
        send('action_result', { step: tc.tool, success, summary: String(result).substring(0, 300) });
      } catch(e) {
        results.push({ tool: tc.tool, error: e.message, success: false });
        send('action_result', { step: tc.tool, success: false, error: e.message });
      }
    }
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BTP Admin Report</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px}h1{color:#0070F2}.ok{color:#16a34a}.fail{color:#dc2626}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0}.badge{background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:4px;font-size:12px}pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;white-space:pre-wrap}</style></head><body><h1>SAP BTP Admin Report <span class="badge">DRAFT</span></h1><p><strong>Instruction:</strong> ${task}</p><p><strong>AI Engine:</strong> ${getActiveEngine()} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p><h2>Actions Executed (${results.filter(r=>r.success).length}/${results.length} succeeded)</h2>${results.length === 0 ? '<div class="card"><p class="fail">âŒ No actions executed</p></div>' : results.map(r => `<div class="card"><p class="${r.success?'ok':'fail'}">${r.success?'âœ…':'âŒ'} ${r.tool}</p><p style="color:#64748b">${r.description||''}</p><pre>${String(r.result||r.error||'').substring(0,800)}</pre></div>`).join('')}</body></html>`;
    if (projectId) {
      const projDir = path.join(PROJECTS_DIR, projectId);
      if (fs.existsSync(projDir)) {
        const fileName = `btp-admin-agent_v${Date.now()}.html`;
        fs.writeFileSync(path.join(projDir, fileName), html);
        const docId = uuidv4();
        db.prepare(`INSERT INTO documents (id, project_id, agent_id, agent_name, file_path, file_name, version, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'draft', datetime('now'))`)
          .run(docId, projectId, 'btp-admin-agent', 'SAP BTP Admin Agent', path.join(projDir, fileName), fileName);
        send('status', { message: 'Report saved to project' });
      }
    }
    send('complete', { html, actionsExecuted: results.length, succeeded: results.filter(r=>r.success).length });
  } catch(e) {
    send('error', { message: e.message });
    logger.error(`BTP run failed: ${e.message}`, { category: 'btp' });
  }
  res.end();
});

// â”€â”€ Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/logs', (req, res) => {
  const { jobId, projectId, level, category, limit } = req.query;
  res.json(logger.getLogs({ jobId, projectId, level, category, limit: parseInt(limit) || 500 }));
});

app.get('/api/logs/stream', (req, res) => {
  sseSetup(req, res);
  const unsub = logger.subscribe(uuidv4(), res);
  req.on('close', unsub);
});

// â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/context/:projectId', (req, res) => {
  res.json(context.getAll(req.params.projectId));
});

// â”€â”€ Skills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/skills', (req, res) => {
  const skillsDir = path.join(__dirname, '../skills');
  const skills = [];
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir).filter(f => f.endsWith('.json')).forEach(f => {
      try { skills.push(JSON.parse(fs.readFileSync(path.join(skillsDir, f), 'utf8'))); } catch(e) {}
    });
  }
  res.json(skills);
});

// â”€â”€ Connectors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/connectors', async (req, res) => {
  const env = readEnv();
  const connectorsDir = path.join(__dirname, '../connectors');
  const result = [];
  if (fs.existsSync(connectorsDir)) {
    const files = fs.readdirSync(connectorsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(connectorsDir, file), 'utf8'));
        c.status = (c.fields||[]).length > 0 && (c.fields||[]).every(field => env[field.key]) ? 'connected' : 'disconnected';
        if (c.id === 'sap-btp-admin') c.status = await btpConnector.isAuthenticated().catch(() => false) ? 'connected' : 'disconnected';
        result.push(c);
      } catch(e) {}
    }
  }
  result.push({ id: 'groq', name: 'Groq AI', type: 'ai', status: process.env.GROQ_API_KEY ? 'connected' : 'disconnected' });
  result.push({ id: 'gemini', name: 'Google Gemini', type: 'ai', status: process.env.GEMINI_API_KEY ? 'connected' : 'disconnected' });
  result.push({ id: 'anthropic', name: 'Anthropic', type: 'ai', status: process.env.ANTHROPIC_API_KEY ? 'connected' : 'disconnected' });
  res.json(result);
});

// GitHub sync
app.post('/api/sync', async (req, res) => {
  try {
    const { syncToGitHub } = require('./core/github-sync');
    const result = await syncToGitHub(DATA_DIR);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€ File serving â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/files', express.static(PROJECTS_DIR));

// â”€â”€ Serve React frontend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const clientBuild = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
server.listen(PORT, () => {
  logger.info(`DeliverAI v2 running on port ${PORT}`, { category: 'server' });
  logger.info(`AI Engine: ${getActiveEngine()}`, { category: 'server' });
  console.log(`\nðŸš€ DeliverAI v2 - http://localhost:${PORT}`);
  console.log(`ðŸ¤– AI Engine: ${getActiveEngine()}`);
  console.log(`ðŸ“ Data: ${DATA_DIR}\n`);
});

module.exports = { app, server };


