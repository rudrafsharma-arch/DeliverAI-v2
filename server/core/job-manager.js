const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../observability/logger');
const { EventEmitter } = require('events');

const emitter = new EventEmitter();
const activeJobs = new Map();
const queue = [];
let queueRunning = false;

function createJob(agentId, agentName, projectId, input, mode) {
  const id = `job-${Date.now()}-${uuidv4().slice(0, 8)}`;
  db.prepare(`INSERT INTO jobs (id, project_id, agent_id, agent_name, status, mode, input, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))`)
    .run(id, projectId || null, agentId, agentName, mode || 'cli', JSON.stringify(input || {}));
  logger.info(`Job created: ${id}`, { jobId: id, projectId, agentId, category: 'job-manager' });
  return id;
}

function updateJob(id, updates) {
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), id];
  db.prepare(`UPDATE jobs SET ${sets} WHERE id = ?`).run(...vals);
  emitter.emit('job:update', { id, ...updates });
}

function getJob(id) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return null;
  try { job.input = JSON.parse(job.input); } catch(e) {}
  return job;
}

function getJobs(projectId, opts = {}) {
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  if (opts.status) { query += ' AND status = ?'; params.push(opts.status); }
  if (opts.agentId) { query += ' AND agent_id = ?'; params.push(opts.agentId); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(opts.limit || 100);
  return db.prepare(query).all(...params).map(j => {
    try { j.input = JSON.parse(j.input); } catch(e) {}
    return j;
  });
}

function startJob(id, runner) {
  const mode = getJob(id)?.mode || 'cli';
  const concurrency = parseInt(process.env.CONCURRENCY || '10');
  if (mode === 'cli') {
    queue.push({ id, runner });
    processQueue();
  } else {
    // API mode - parallel up to concurrency limit
    if (activeJobs.size < concurrency) {
      runJob(id, runner);
    } else {
      queue.push({ id, runner });
    }
  }
}

async function processQueue() {
  if (queueRunning || queue.length === 0) return;
  queueRunning = true;
  const { id, runner } = queue.shift();
  await runJob(id, runner);
  queueRunning = false;
  processQueue();
}

async function runJob(id, runner) {
  activeJobs.set(id, true);
  updateJob(id, { status: 'running', started_at: new Date().toISOString() });
  logger.info(`Job started: ${id}`, { jobId: id, category: 'job-manager' });
  try {
    const result = await runner(id, (event, data) => {
      emitter.emit('job:event', { jobId: id, event, data });
    });
    updateJob(id, { status: 'completed', output: typeof result === 'string' ? result : JSON.stringify(result), completed_at: new Date().toISOString() });
    logger.info(`Job completed: ${id}`, { jobId: id, category: 'job-manager' });
  } catch(e) {
    updateJob(id, { status: 'failed', error: e.message, completed_at: new Date().toISOString() });
    logger.error(`Job failed: ${id} - ${e.message}`, { jobId: id, category: 'job-manager' });
  } finally {
    activeJobs.delete(id);
    // Process next in queue for API mode
    if (queue.length > 0) {
      const next = queue.shift();
      runJob(next.id, next.runner);
    }
  }
}

function cancelJob(id) {
  const idx = queue.findIndex(j => j.id === id);
  if (idx !== -1) { queue.splice(idx, 1); updateJob(id, { status: 'cancelled' }); return true; }
  if (activeJobs.has(id)) { updateJob(id, { status: 'cancelled' }); activeJobs.delete(id); return true; }
  return false;
}

module.exports = { createJob, updateJob, getJob, getJobs, startJob, cancelJob, emitter };