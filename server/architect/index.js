const { callAI } = require('../core/ai-engine');
const context = require('../core/context');
const logger = require('../observability/logger');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

const architectEmitter = new EventEmitter();
const pendingQuestions = new Map();

const SYSTEM_PROMPT = `You are the Architect of DeliverAI, an SAP delivery platform.

Respond with JSON only. Two formats:

1. For questions, information, advice - just answer:
{"action": "none", "reply": "your answer here"}

2. ONLY when user explicitly says "run", "execute", "do it", "create", "generate", "provision", "deploy" - trigger an agent:
{"action": "run_agent", "agentId": "agent-id", "task": "what to do", "reply": "telling user what you are doing"}

Available agents (only use when explicitly asked to run/execute/create/generate something):
- btp-admin-agent: run BTP actions (provision, deploy, configure)
- blueprint: generate Business Blueprint document
- functional-spec: generate Functional Specification
- technical-spec: generate Technical Specification
- estimation-agent: generate project estimation
- risk-register-agent: generate risk register
- incident-analyser: analyse an incident

For questions like "what services are on BTP?", "how does X work?", "what is Y?" -> action: none, just answer.
For commands like "check BTP", "run the agent", "generate a blueprint" -> action: run_agent.

Be concise. Max 2 sentences for replies. Keep JSON short.`;

async function chat(message, projectId, conversationHistory) {
  logger.info('Architect: ' + message.substring(0, 50), { projectId, category: 'architect' });
  const history = (conversationHistory || []).slice(-4);
  const prompt = history.map(m => (m.role === 'user' ? 'Human' : 'Architect') + ': ' + m.content).join('\n') +
    '\nHuman: ' + message + '\nArchitect:';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  const text = response.trim();
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    // Find JSON object
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) return { text: text || 'How can I help?' };
    const parsed = JSON.parse(clean.substring(start, end + 1));
    if (parsed.action === 'run_agent') {
      return { text: parsed.reply || 'Running ' + parsed.agentId + '...', action: { type: 'run_agent', agentId: parsed.agentId, task: parsed.task } };
    }
    return { text: parsed.reply || text };
  } catch(e) {
    return { text: text || 'How can I help?' };
  }
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
  const prompt = 'Agent ' + agentId + ' asks: "' + question + '"\nContext: ' + JSON.stringify(projectContext).substring(0, 300) + '\nCan you answer? JSON: {"canAnswer": true/false, "confidence": 0-100, "answer": "...", "reason": "..."}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.confidence >= threshold && parsed.canAnswer) {
      logger.info('Auto-answered (' + parsed.confidence + '%): ' + question.substring(0, 40), { category: 'architect' });
      return { answered: true, answer: parsed.answer, confidence: parsed.confidence, byArchitect: true };
    }
    return { answered: false, confidence: parsed.confidence, reason: parsed.reason, needsHuman: true };
  } catch(e) {
    return { answered: false, needsHuman: true, reason: 'Parse error' };
  }
}

async function createRuntimeAgent(purpose, context_data) {
  const prompt = 'Create an agent for: "' + purpose + '"\nJSON: {"id": "runtime-xxx", "name": "Name", "prompt": "system prompt", "inputs": [], "outputs": []}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const agentDef = JSON.parse(clean);
    agentDef.id = agentDef.id || 'runtime-' + Date.now();
    agentDef.type = 'runtime';
    db.prepare('INSERT OR REPLACE INTO agents (id, name, type, manifest, prompt, created_by, created_at, updated_at) VALUES (?, ?, \'runtime\', ?, ?, \'architect\', datetime(\'now\'), datetime(\'now\'))')
      .run(agentDef.id, agentDef.name, JSON.stringify(agentDef), agentDef.prompt);
    return agentDef;
  } catch(e) { throw new Error('Failed to create agent: ' + e.message); }
}

async function analyzeDocumentDiff(originalContent, newContent, projectId) {
  const prompt = 'What changed semantically?\nOriginal: ' + originalContent.substring(0, 500) + '\nNew: ' + newContent.substring(0, 500) + '\nJSON: {"changes": [], "affectedAgents": [], "severity": "low/medium/high", "summary": ""}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 400 });
  try { return JSON.parse(response.replace(/```json|```/g, '').trim()); }
  catch(e) { return { changes: [], affectedAgents: [], severity: 'low', summary: 'Could not analyze' }; }
}

function askHuman(question, agentId, projectId, options) {
  const id = uuidv4();
  const rec = { id, question, agentId, projectId, options: options || [], createdAt: new Date().toISOString() };
  pendingQuestions.set(id, rec);
  architectEmitter.emit('question', rec);
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


