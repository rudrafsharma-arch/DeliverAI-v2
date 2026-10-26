const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_DIR = path.join(DATA_DIR, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Tables stored as JSON files
const TABLES = ['projects','jobs','documents','agents','skills','connectors','messages','logs','context_store','settings','audit_trail'];
const store = {};

function loadTable(name) {
  const file = path.join(DB_DIR, name + '.json');
  if (!store[name]) {
    store[name] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  }
  return store[name];
}

function saveTable(name) {
  const file = path.join(DB_DIR, name + '.json');
  fs.writeFileSync(file, JSON.stringify(store[name] || [], null, 2));
}

function now() { return new Date().toISOString(); }

// SQLite-compatible interface
const db = {
  prepare(sql) {
    return {
      run(...args) { return execSQL(sql, args); },
      get(...args) { return querySQL(sql, args, true); },
      all(...args) { return querySQL(sql, args, false); }
    };
  },
  exec(sql) {
    // Initialize tables - just ensure they exist
    TABLES.forEach(t => loadTable(t));
  }
};

function getTable(sql) {
  const match = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i) || sql.match(/DELETE FROM\s+(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}

function execSQL(sql, args) {
  const s = sql.trim().toUpperCase();
  const table = getTable(sql);
  if (!table) return { changes: 0 };
  const rows = loadTable(table);

  if (s.startsWith('INSERT')) {
    // Extract columns and values
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
    const valMatch = sql.match(/VALUES\s*\(([^)]+)\)/);
    if (!colMatch || !valMatch) return { changes: 0 };
    const cols = colMatch[1].split(',').map(c => c.trim().replace(/`/g,''));
    const row = {};
    let argIdx = 0;
    cols.forEach(col => {
      row[col] = args[argIdx] !== undefined ? args[argIdx] : null;
      argIdx++;
    });
    if (!row.created_at) row.created_at = now();
    if (!row.updated_at) row.updated_at = now();
    // Handle ON CONFLICT UPDATE
    if (sql.includes('ON CONFLICT') && sql.includes('DO UPDATE')) {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx !== -1) { rows[idx] = { ...rows[idx], ...row, updated_at: now() }; }
      else rows.push(row);
    } else {
      rows.push(row);
    }
    saveTable(table);
    return { changes: 1, lastInsertRowid: row.id };
  }

  if (s.startsWith('UPDATE')) {
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
    if (!setMatch) return { changes: 0 };
    const sets = setMatch[1].split(',').map(s => s.trim());
    const wherePart = sql.match(/WHERE\s+(.+?)(?:$|ORDER|LIMIT)/is)?.[1] || '';
    let argIdx = 0;
    const updates = {};
    sets.forEach(set => {
      const [col] = set.split('=').map(s => s.trim().replace(/`/g,''));
      if (!col.includes('datetime')) updates[col] = args[argIdx++];
    });
    const whereArgs = args.slice(argIdx);
    let changed = 0;
    rows.forEach((row, i) => {
      if (matchesWhere(row, wherePart, whereArgs)) {
        rows[i] = { ...row, ...updates, updated_at: now() };
        changed++;
      }
    });
    if (changed) saveTable(table);
    return { changes: changed };
  }

  if (s.startsWith('DELETE')) {
    const wherePart = sql.match(/WHERE\s+(.+)/is)?.[1] || '';
    const before = rows.length;
    const filtered = rows.filter(row => !matchesWhere(row, wherePart, args));
    store[table] = filtered;
    const changed = before - filtered.length;
    if (changed) saveTable(table);
    return { changes: changed };
  }

  return { changes: 0 };
}

function querySQL(sql, args, single) {
  const table = getTable(sql);
  if (!table) return single ? null : [];
  let rows = [...loadTable(table)];

  // Handle COUNT
  if (sql.match(/SELECT COUNT/i)) {
    const wherePart = sql.match(/WHERE\s+(.+?)(?:$|ORDER|LIMIT|GROUP)/is)?.[1] || '';
    const count = wherePart ? rows.filter(r => matchesWhere(r, wherePart, args)).length : rows.length;
    return single ? { count } : [{ count }];
  }

  // WHERE
  const wherePart = sql.match(/WHERE\s+(.+?)(?:$|ORDER|LIMIT|GROUP)/is)?.[1] || '';
  const whereArgs = [];
  let sqlArgIdx = 0;
  if (wherePart) {
    const conditions = wherePart.split(/\s+AND\s+/i);
    rows = rows.filter(row => {
      return conditions.every(cond => {
        if (cond.includes('?')) { 
          const val = args[sqlArgIdx++];
          return evalCondition(row, cond, val);
        }
        return true;
      });
    });
  }

  // ORDER BY
  const orderMatch = sql.match(/ORDER BY\s+([\w.]+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const col = orderMatch[1].split('.').pop();
    const dir = (orderMatch[2] || 'ASC').toUpperCase();
    rows.sort((a, b) => {
      const av = a[col] || '', bv = b[col] || '';
      return dir === 'ASC' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

  return single ? (rows[0] || null) : rows;
}

function evalCondition(row, cond, val) {
  const eqMatch = cond.match(/(\w+)\s*=\s*\?/i);
  if (eqMatch) return row[eqMatch[1]] == val;
  const neqMatch = cond.match(/(\w+)\s*!=\s*\?/i);
  if (neqMatch) return row[neqMatch[1]] != val;
  return true;
}

function matchesWhere(row, where, args) {
  if (!where.trim()) return true;
  const conditions = where.split(/\s+AND\s+/i);
  let argIdx = 0;
  return conditions.every(cond => {
    const val = cond.includes('?') ? args[argIdx++] : undefined;
    return evalCondition(row, cond, val);
  });
}

// Initialize
TABLES.forEach(t => loadTable(t));
console.log('✅ JSON database initialized at', DB_DIR);

module.exports = db;