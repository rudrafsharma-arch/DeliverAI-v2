const { callAI } = require('../core/ai-engine');
const context = require('../core/context');
const logger = require('../observability/logger');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

const architectEmitter = new EventEmitter();
const pendingQuestions = new Map();

const SYSTEM_PROMPT = `You are the Architect of DeliverAI, an SAP delivery platform.
You can run agents to take real actions.

When the user wants something done (not just answered), respond with ONLY this JSON:
{"action": "run_agent", "agentId": "btp-admin-agent", "task": "what to do", "reply": "what you tell the user"}

When the user just wants information or a conversation, respond with ONLY this JSON:
{"action": "none", "reply": "your response here"}

Agent IDs you can run:
- btp-admin-agent: for anything on SAP BTP (services, subscriptions, roles, entitlements)
- blueprint: generate Business Blueprint
- functional-spec: generate Functional Specification
- technical-spec: generate Technical Specification  
- estimation-agent: project estimation
- risk-register-agent: risk register
- incident-analyser: analyse SAP incidents

Rules:
- ALWAYS respond with valid JSON only. No other text.
- For BTP questions like services, subscriptions, roles -> use btp-admin-agent
- Keep reply concise (1-2 sentences)`;

async function chat(message, projectId, conversationHistory) {
  logger.info('Architect: ' + message.substring(0, 50), { projectId, category: 'architect' });
  const history = (conversationHistory || []).slice(-4);
  const prompt = history.map(m => (m.role === 'user' ? 'Human' : 'Architect') + ': ' + m.content).join('\n') +
    '\nHuman: ' + message + '\nArchitect:';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 300 });
  const text = response.trim();
  // Parse JSON response
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.action === 'run_agent') {
      return { text: parsed.reply || 'Running ' + parsed.agentId + '...', action: { type: 'run_agent', agentId: parsed.agentId, task: parsed.task } };
    }
    return { text: parsed.reply || text };
  } catch(e) {
    // Not JSON - return as plain text
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
  const prompt = 'Agent ' + agentId + ' asks: "' + question + '"\nContext: ' + JSON.stringify(projectContext).substring(0, 300) + '\nCan you answer confidently? JSON: {"canAnswer": true/false, "confidence": 0-100, "answer": "...", "reason": "..."}';
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 300 });
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