const fs = require('fs');
const path = require('path');
const { callAI } = require('../core/ai-engine');
const context = require('../core/context');
const logger = require('../observability/logger');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const AGENTS_DIR = path.join(__dirname, '../../agents');
const DATA_DIR = process.env.DATA_DIR || './data';

function loadAllAgents() {
  const agents = [];
  if (!fs.existsSync(AGENTS_DIR)) return agents;
  const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of dirs) {
    const manifestPath = path.join(AGENTS_DIR, dir.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const promptPath = path.join(AGENTS_DIR, dir.name, 'prompt.md');
      const formPath = path.join(AGENTS_DIR, dir.name, 'form.json');
      if (fs.existsSync(promptPath)) manifest.prompt = fs.readFileSync(promptPath, 'utf8');
      if (fs.existsSync(formPath)) manifest.form = JSON.parse(fs.readFileSync(formPath, 'utf8'));
      agents.push(manifest);
    } catch(e) {
      logger.warn(`Failed to load agent ${dir.name}: ${e.message}`, { category: 'agents' });
    }
  }
  // Also load runtime agents from DB
  const runtimeAgents = db.prepare("SELECT * FROM agents WHERE type IN ('runtime','learned') AND status = 'active'").all();
  for (const agent of runtimeAgents) {
    try {
      const manifest = JSON.parse(agent.manifest);
      manifest.prompt = agent.prompt;
      manifest.type = agent.type;
      agents.push(manifest);
    } catch(e) {}
  }
  return agents;
}

function getAgent(agentId) {
  return loadAllAgents().find(a => a.id === agentId);
}

async function runAgent(agentId, formData, projectId, jobId, onEvent) {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  logger.info(`Running agent: ${agentId}`, { jobId, projectId, agentId, category: 'agent-runner' });
  onEvent('status', { message: `Starting ${agent.name}...` });

  // Build prompt
  const projectContext = projectId ? context.getAll(projectId) : {};
  const systemPrompt = agent.prompt || `You are ${agent.name}. ${agent.description || ''}`;
  const userPrompt = buildPrompt(agent, formData, projectContext);

  onEvent('status', { message: 'Calling AI engine...' });
  const output = await callAI(userPrompt, systemPrompt, { maxTokens: agent.maxTokens || 8000 });

  // Extract HTML if present, otherwise wrap in HTML
  const html = output.includes('<!DOCTYPE') || output.includes('<html')
    ? output
    : wrapInHtml(output, agent, formData);

  // Save document
  const docId = uuidv4();
  const fileName = `${agentId}_v${Date.now()}.html`;
  const projectDir = projectId ? path.join(DATA_DIR, 'projects', projectId) : path.join(DATA_DIR, 'projects', 'general');
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
  const filePath = path.join(projectDir, fileName);
  fs.writeFileSync(filePath, html);

  // Save to DB
  const version = db.prepare('SELECT COUNT(*) as count FROM documents WHERE project_id = ? AND agent_id = ?').get(projectId, agentId)?.count + 1 || 1;
  db.prepare(`INSERT INTO documents (id, project_id, job_id, agent_id, agent_name, file_path, file_name, version, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'))`)
    .run(docId, projectId || null, jobId, agentId, agent.name, filePath, fileName);

  // Store in context for other agents
  if (projectId) context.set(projectId, agentId, { fileName, filePath, summary: output.substring(0, 500) }, agentId);

  onEvent('complete', { html, fileName, docId, agentName: agent.name });
  logger.info(`Agent completed: ${agentId}`, { jobId, projectId, agentId, category: 'agent-runner' });
  return { html, fileName, docId };
}

function buildPrompt(agent, formData, projectContext) {
  let prompt = '';
  if (formData.projectName) prompt += `Project: ${formData.projectName}\n`;
  if (formData.client) prompt += `Client: ${formData.client}\n`;
  if (formData.processName) prompt += `Process: ${formData.processName}\n`;
  if (formData.description) prompt += `\nDescription:\n${formData.description}\n`;
  if (Object.keys(projectContext).length > 0) {
    prompt += `\nExisting project context (from other agents):\n`;
    for (const [key, val] of Object.entries(projectContext)) {
      if (val?.summary) prompt += `${key}: ${val.summary}\n`;
    }
  }
  // Add any custom form fields
  for (const [key, val] of Object.entries(formData)) {
    if (!['projectName', 'client', 'processName', 'description'].includes(key) && val) {
      prompt += `${key}: ${val}\n`;
    }
  }
  prompt += `\nGenerate a complete, professional document in HTML format. Include proper styling, tables, and structure. Mark as DRAFT status.`;
  return prompt;
}

function wrapInHtml(content, agent, formData) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${agent.name}</title>
<style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px;line-height:1.6}h1{color:#0070F2}h2{color:#333;border-bottom:2px solid #0070F2;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0070F2;color:white;padding:10px}td{border:1px solid #e2e8f0;padding:8px}.badge{background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold}</style>
</head><body>
<h1>${agent.name} <span class="badge">DRAFT</span></h1>
<p><strong>Project:</strong> ${formData.projectName || 'N/A'} | <strong>Client:</strong> ${formData.client || 'N/A'}</p>
<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
<hr/>
${content.replace(/\n/g, '<br/>')}
</body></html>`;
}

module.exports = { loadAllAgents, getAgent, runAgent };