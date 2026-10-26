const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || 1;

// SSE subscribers for live log streaming
const subscribers = new Map();

function subscribe(id, res) {
  subscribers.set(id, res);
  return () => subscribers.delete(id);
}

function broadcast(entry) {
  const data = JSON.stringify({ type: 'log', ...entry });
  for (const [id, res] of subscribers) {
    try { res.write(`data: ${data}\n\n`); }
    catch(e) { subscribers.delete(id); }
  }
}

function log(level, message, opts = {}) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    id: uuidv4(),
    level,
    message,
    job_id: opts.jobId || null,
    project_id: opts.projectId || null,
    agent_id: opts.agentId || null,
    category: opts.category || 'system',
    metadata: JSON.stringify(opts.metadata || {}),
    created_at: new Date().toISOString()
  };
  // Print to console
  const prefix = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level] || '';
  console.log(`${prefix} [${level.toUpperCase()}] ${entry.category}: ${message}`);
  // Save to DB
  try {
    db.prepare(`INSERT INTO logs (job_id, project_id, agent_id, level, category, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(entry.job_id, entry.project_id, entry.agent_id, level, entry.category, message, entry.metadata, entry.created_at);
  } catch(e) {}
  // Broadcast to live subscribers
  broadcast(entry);
}

const logger = {
  debug: (msg, opts) => log('debug', msg, opts),
  info: (msg, opts) => log('info', msg, opts),
  warn: (msg, opts) => log('warn', msg, opts),
  error: (msg, opts) => log('error', msg, opts),
  subscribe,
  getLogs: (opts = {}) => {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params = [];
    if (opts.jobId) { query += ' AND job_id = ?'; params.push(opts.jobId); }
    if (opts.projectId) { query += ' AND project_id = ?'; params.push(opts.projectId); }
    if (opts.level) { query += ' AND level = ?'; params.push(opts.level); }
    if (opts.category) { query += ' AND category = ?'; params.push(opts.category); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(opts.limit || 500);
    return db.prepare(query).all(...params);
  }
};

module.exports = logger;