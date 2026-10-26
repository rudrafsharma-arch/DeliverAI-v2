const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const context = {
  set(projectId, key, value, agentId = 'system') {
    const id = `${projectId}:${key}`;
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(`INSERT INTO context_store (id, project_id, key, value, agent_id, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET value=excluded.value, agent_id=excluded.agent_id, updated_at=excluded.updated_at`)
      .run(id, projectId, key, val, agentId);
  },
  get(projectId, key) {
    const row = db.prepare('SELECT value FROM context_store WHERE project_id = ? AND key = ?').get(projectId, key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch(e) { return row.value; }
  },
  getAll(projectId) {
    const rows = db.prepare('SELECT key, value, agent_id, updated_at FROM context_store WHERE project_id = ? ORDER BY updated_at DESC').all(projectId);
    const result = {};
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value); } catch(e) { result[row.key] = row.value; }
    }
    return result;
  },
  delete(projectId, key) {
    db.prepare('DELETE FROM context_store WHERE project_id = ? AND key = ?').run(projectId, key);
  },
  clear(projectId) {
    db.prepare('DELETE FROM context_store WHERE project_id = ?').run(projectId);
  }
};

module.exports = context;