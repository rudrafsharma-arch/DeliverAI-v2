require('dotenv').config();
try {
  const db = require('./server/db');
  console.log('DB OK');
  const agents = require('./server/agents/runner');
  const all = agents.loadAllAgents();
  console.log('Agents loaded:', all.length);
  const { getActiveEngine } = require('./server/core/ai-engine');
  console.log('AI Engine:', getActiveEngine());
  console.log('ALL GOOD - Ready to start!');
} catch(e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}