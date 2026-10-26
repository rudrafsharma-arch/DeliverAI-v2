const { callAI } = require('../core/ai-engine');
const context = require('../core/context');
const logger = require('../observability/logger');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

const architectEmitter = new EventEmitter();
const pendingQuestions = new Map();

const SYSTEM_PROMPT = `You are the Architect of DeliverAI, an autonomous SAP delivery platform.
You can actually run agents and take actions - not just describe them.

When a user asks you to do something, you MUST respond with a JSON action block if action is needed:
<action>
{"type": "run_agent", "agentId": "btp-admin-agent", "task": "what to do"}
</action>

Available action types:
- run_agent: {"type": "run_agent", "agentId": "agent-id", "task": "description"}
- answer: just reply in plain text (no action needed)

Available agents: btp-admin-agent, blueprint, functional-spec, technical-spec, estimation-agent, risk-register-agent, incident-analyser, cutover-plan-agent, project-charter-agent

Rules:
- If user asks to connect/check/run something on BTP -> use run_agent with btp-admin-agent
- If user asks to generate a document -> use run_agent with the right agent
- If user asks a question -> just answer in plain text, no action block
- Be concise. Max 3 sentences for plain answers.
- Never say "I can't do X directly" - you CAN do it via agents.`;

async function chat(message, projectId, conversationHistory) {
  logger.info('Architect: ' + message.substring(0, 50), { projectId, category: 'architect' });
  const projectContext = projectId ? context.getAll(projectId) : {};
  const history = (conversationHistory || []).slice(-6);
  const prompt = history.map(m => (m.role === 'user' ? 'Human' : 'Architect') + ': ' + m.content).join('\n') +
    '\nHuman: ' + message +
    (Object.keys(projectContext).length > 0 ? '\nContext: ' + JSON.stringify(projectContext).substring(0, 300) : '') +
    '\nArchitect:';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 500 });
  const text = response.trim();

  // Parse action if present
  const actionMatch = text.match(/<action>([\s\S]*?)<\/action>/);
  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1].trim());
      const textOnly = text.replace(/<action>[\s\S]*?<\/action>/, '').trim();
      return { text: textOnly || 'On it! Running ' + action.agentId + '...', action };
    } catch(e) {}
  }
  return { text: text || 'How can I help you?' };
}

async function planExecution(userGoal, projectId, availableAgents) {
  const prompt = 'Goal: ' + userGoal + '\nAgents: ' + availableAgents.map(a => a.id + ': ' + a.name).join(', ') + '\nPlan which agents to run. JSON array only: [{"agentId": "id", "reason": "why", "parallel": true}]';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 500 });
  try {
    const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch(e) { return []; }
}

async function answerQuestion(question, projectId, agentId, confidenceThreshold) {
  const threshold = confidenceThreshold || parseInt(process.env.CONFIDENCE_THRESHOLD || '80');
  const projectContext = context.getAll(projectId || 'none');
  const prompt = 'Agent ' + agentId + ' asks: "' + question + '"\nContext: ' + JSON.stringify(projectContext).substring(0, 300) + '\nCan you answer confidently? JSON: {"canAnswer": true/false, "confidence": 0-100, "answer": "...", "reason": "..."}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 300 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.confidence >= threshold && parsed.canAnswer) {
      logger.info('Auto-answered (' + parsed.confidence + '%): ' + question.substring(0, 40), { category: 'architect' });
      db.prepare('INSERT INTO audit_trail (action, actor, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
        .run('auto-answer', 'architect', 'agent', agentId, JSON.stringify({ question, answer: parsed.answer, confidence: parsed.confidence }));
      return { answered: true, answer: parsed.answer, confidence: parsed.confidence, byArchitect: true };
    }
    return { answered: false, confidence: parsed.confidence, reason: parsed.reason, needsHuman: true };
  } catch(e) {
    return { answered: false, needsHuman: true, reason: 'Parse error' };
  }
}

async function createRuntimeAgent(purpose, context_data) {
  const prompt = 'Create an agent for: "' + purpose + '"\nContext: ' + JSON.stringify(context_data).substring(0, 200) + '\nJSON: {"id": "runtime-xxx", "name": "Name", "prompt": "system prompt", "inputs": [], "outputs": []}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const agentDef = JSON.parse(clean);
    agentDef.id = agentDef.id || 'runtime-' + Date.now();
    agentDef.type = 'runtime';
    db.prepare('INSERT OR REPLACE INTO agents (id, name, type, manifest, prompt, created_by, created_at, updated_at) VALUES (?, ?, \'runtime\', ?, ?, \'architect\', datetime(\'now\'), datetime(\'now\'))')
      .run(agentDef.id, agentDef.name, JSON.stringify(agentDef), agentDef.prompt);
    logger.info('Runtime agent created: ' + agentDef.name, { category: 'architect' });
    return agentDef;
  } catch(e) { throw new Error('Failed to create agent: ' + e.message); }
}

async function analyzeDocumentDiff(originalContent, newContent, projectId) {
  const prompt = 'What changed semantically?\nOriginal: ' + originalContent.substring(0, 800) + '\nNew: ' + newContent.substring(0, 800) + '\nJSON: {"changes": [], "affectedAgents": [], "severity": "low/medium/high", "summary": ""}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 400 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) { return { changes: [], affectedAgents: [], severity: 'low', summary: 'Could not analyze' }; }
}

function askHuman(question, agentId, projectId, options) {
  const id = uuidv4();
  const rec = { id, question, agentId, projectId, options: options || [], createdAt: new Date().toISOString(), answered: false };
  pendingQuestions.set(id, rec);
  architectEmitter.emit('question', rec);
  logger.info('Question for human from ' + agentId + ': ' + question.substring(0, 50), { projectId, category: 'architect' });
  return new Promise(function(resolve) {
    const timeout = setTimeout(function() { pendingQuestions.delete(id); resolve({ answer: null, timedOut: true }); }, 5 * 60 * 1000);
    rec.resolve = function(answer) { clearTimeout(timeout); pendingQuestions.delete(id); resolve({ answer }); };
  });
}

function answerHumanQuestion(questionId, answer) {
  const q = pendingQuestions.get(questionId);
  if (!q) return false;
  q.resolve(answer);
  architectEmitter.emit('answered', { questionId, answer });
  return true;
}

function getPendingQuestions(projectId) {
  return Array.from(pendingQuestions.values()).filter(function(q) { return !projectId || q.projectId === projectId; });
}

module.exports = { chat, planExecution, answerQuestion, createRuntimeAgent, analyzeDocumentDiff, askHuman, answerHumanQuestion, getPendingQuestions, architectEmitter };