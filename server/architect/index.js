const { callAI } = require('../core/ai-engine');
const context = require('../core/context');
const { createJob, startJob, updateJob } = require('../core/job-manager');
const logger = require('../observability/logger');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

const architectEmitter = new EventEmitter();
const pendingQuestions = new Map();

const SYSTEM_PROMPT = `You are the Architect — the intelligence core of DeliverAI, an autonomous SAP delivery platform.

Your responsibilities:
1. Understand any request in natural language
2. Plan which agents/skills to invoke
3. Coordinate agent execution and communication
4. Answer agent questions when confident (>threshold)
5. Escalate to human when not confident
6. Create new agents at runtime when needed
7. Propagate document changes to dependent agents
8. Fix issues autonomously in connected systems
9. Always keep the human informed

You have access to:
- 50+ pre-built SAP delivery agents
- Skills library (atomic capabilities)
- Connectors (SAP BTP, S/4HANA, ServiceNow, etc.)
- Full project context and document history
- AI engine for any task

Always respond in JSON when asked for structured output.
Always be transparent about what you are doing and why.
Always ask for human input when confidence is below threshold.`;

async function chat(message, projectId, conversationHistory = []) {
  logger.info(`Architect chat: ${message.substring(0, 50)}`, { projectId, category: 'architect' });
  const projectContext = projectId ? context.getAll(projectId) : {};
  const contextStr = Object.keys(projectContext).length > 0
    ? `\n\nProject Context:\n${JSON.stringify(projectContext, null, 2)}`
    : '';
  const messages = [
    ...conversationHistory,
    { role: 'user', content: message + contextStr }
  ];
  const prompt = messages.map(m => `${m.role === 'user' ? 'Human' : 'Architect'}: ${m.content}`).join('\n\n');
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 2000 });
  logger.info(`Architect responded`, { projectId, category: 'architect' });
  return response;
}

async function planExecution(userGoal, projectId, availableAgents) {
  logger.info(`Architect planning: ${userGoal.substring(0, 50)}`, { projectId, category: 'architect' });
  const prompt = `User goal: ${userGoal}\n\nAvailable agents: ${availableAgents.map(a => a.id + ': ' + a.name).join(', ')}\n\nProject context: ${JSON.stringify(context.getAll(projectId || 'none'))}\n\nCreate an execution plan. Respond with ONLY a JSON array:\n[{"agentId": "agent-id", "reason": "why", "parallel": true/false, "dependsOn": ["other-agent-id"] }]`;
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch(e) {
    logger.error(`Plan parsing failed: ${e.message}`, { category: 'architect' });
    return [];
  }
}

async function answerQuestion(question, projectId, agentId, confidenceThreshold) {
  const threshold = confidenceThreshold || parseInt(process.env.CONFIDENCE_THRESHOLD || '80');
  const projectContext = context.getAll(projectId || 'none');
  const prompt = `An agent (${agentId}) is asking: "${question}"\n\nProject context:\n${JSON.stringify(projectContext, null, 2)}\n\nCan you answer this with high confidence? Respond with JSON only:\n{"canAnswer": true/false, "confidence": 0-100, "answer": "your answer or null", "reason": "why you can or cannot answer"}`;
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 500 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.confidence >= threshold && parsed.canAnswer) {
      logger.info(`Architect auto-answered (${parsed.confidence}%): ${question.substring(0, 50)}`, { category: 'architect' });
      db.prepare(`INSERT INTO audit_trail (action, actor, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
        .run('auto-answer', 'architect', 'agent', agentId, JSON.stringify({ question, answer: parsed.answer, confidence: parsed.confidence }));
      return { answered: true, answer: parsed.answer, confidence: parsed.confidence, byArchitect: true };
    } else {
      return { answered: false, confidence: parsed.confidence, reason: parsed.reason, needsHuman: true };
    }
  } catch(e) {
    return { answered: false, needsHuman: true, reason: 'Could not parse architect response' };
  }
}

async function createRuntimeAgent(purpose, context_data, availableSkills, availableConnectors) {
  logger.info(`Architect creating runtime agent: ${purpose}`, { category: 'architect' });
  const prompt = `Create a new agent for this purpose: "${purpose}"\n\nAvailable skills: ${JSON.stringify(availableSkills)}\nAvailable connectors: ${JSON.stringify(availableConnectors)}\nContext: ${JSON.stringify(context_data)}\n\nRespond with JSON only:\n{"id": "agent-id", "name": "Agent Name", "prompt": "full system prompt for this agent", "skills": ["skill-id"], "connectors": ["connector-id"], "inputs": ["input-key"], "outputs": ["output-key"]}`;
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 2000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const agentDef = JSON.parse(clean);
    agentDef.id = agentDef.id || `runtime-${Date.now()}`;
    agentDef.type = 'runtime';
    agentDef.created_by = 'architect';
    // Save to DB
    db.prepare(`INSERT OR REPLACE INTO agents (id, name, type, manifest, prompt, created_by, created_at, updated_at)
      VALUES (?, ?, 'runtime', ?, ?, 'architect', datetime('now'), datetime('now'))`)
      .run(agentDef.id, agentDef.name, JSON.stringify(agentDef), agentDef.prompt);
    logger.info(`Runtime agent created: ${agentDef.name}`, { category: 'architect' });
    return agentDef;
  } catch(e) {
    logger.error(`Runtime agent creation failed: ${e.message}`, { category: 'architect' });
    throw e;
  }
}

async function analyzeDocumentDiff(originalContent, newContent, projectId) {
  logger.info('Architect analyzing document diff', { projectId, category: 'architect' });
  const prompt = `Original document:\n${originalContent.substring(0, 2000)}\n\nUpdated document:\n${newContent.substring(0, 2000)}\n\nWhat changed semantically? Which dependent agents need to re-run?\nRespond with JSON only:\n{"changes": ["change description"], "affectedAgents": ["agent-id"], "severity": "low/medium/high", "summary": "one line summary"}`;
  const response = await callAI(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    return { changes: [], affectedAgents: [], severity: 'low', summary: 'Could not analyze diff' };
  }
}

function askHuman(question, agentId, projectId, options = []) {
  const id = uuidv4();
  const questionRecord = { id, question, agentId, projectId, options, createdAt: new Date().toISOString(), answered: false };
  pendingQuestions.set(id, questionRecord);
  db.prepare(`INSERT INTO messages (id, job_id, project_id, from_agent, to_agent, type, content, created_at)
    VALUES (?, ?, ?, ?, 'human', 'question', ?, datetime('now'))`)
    .run(id, null, projectId, agentId, JSON.stringify({ question, options }));
  architectEmitter.emit('question', questionRecord);
  logger.info(`Question for human from ${agentId}: ${question.substring(0, 50)}`, { projectId, category: 'architect' });
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingQuestions.delete(id);
      resolve({ answer: null, timedOut: true });
    }, 5 * 60 * 1000); // 5 min timeout
    questionRecord.resolve = (answer) => {
      clearTimeout(timeout);
      pendingQuestions.delete(id);
      resolve({ answer });
    };
  });
}

function answerHumanQuestion(questionId, answer) {
  const question = pendingQuestions.get(questionId);
  if (!question) return false;
  db.prepare(`UPDATE messages SET answered = 1, answer = ? WHERE id = ?`).run(answer, questionId);
  question.resolve(answer);
  architectEmitter.emit('answered', { questionId, answer });
  logger.info(`Human answered question ${questionId}: ${answer.substring(0, 50)}`, { category: 'architect' });
  return true;
}

function getPendingQuestions(projectId) {
  return Array.from(pendingQuestions.values()).filter(q => !projectId || q.projectId === projectId);
}

module.exports = { chat, planExecution, answerQuestion, createRuntimeAgent, analyzeDocumentDiff, askHuman, answerHumanQuestion, getPendingQuestions, architectEmitter };