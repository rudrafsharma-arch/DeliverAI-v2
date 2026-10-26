import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const LEVEL_COLOR = { debug: '#94a3b8', info: '#3b82f6', warn: '#f59e0b', error: '#dc2626' };

export default function Logs({ project }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/api/logs?projectId=${project?.id || ''}&limit=500`).then(setLogs).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    if (!live) return;
    const es = new EventSource('http://localhost:3005/api/logs/stream');
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'log') setLogs(l => [...l.slice(-999), d]);
      } catch(err) {}
    };
    return () => es.close();
  }, [live]);

  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.message?.toLowerCase().includes(search.toLowerCase()) && !l.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>System Logs</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..."
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', width: 200 }} />
          <button onClick={() => setLive(l => !l)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: live ? '#16a34a' : '#94a3b8', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {live ? '🟢 Live' : '⏸ Paused'}
          </button>
          <button onClick={() => setLogs([])} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Clear</button>
        </div>
      </div>
      {/* Level filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['all', 'debug', 'info', 'warn', 'error'].map(l => (
          <button key={l} onClick={() => setFilter(l)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: filter === l ? (LEVEL_COLOR[l] || '#3b82f6') : '#f1f5f9', color: filter === l ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: filter === l ? 600 : 400, textTransform: 'capitalize' }}>{l}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{filtered.length} entries</span>
      </div>
      {/* Log entries */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: 16, height: 'calc(100vh - 220px)', overflowY: 'auto', fontFamily: 'monospace' }}>
        {filtered.map((log, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 3, fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: '#475569', flexShrink: 0 }}>{new Date(log.created_at || Date.now()).toLocaleTimeString()}</span>
            <span style={{ color: LEVEL_COLOR[log.level] || '#94a3b8', flexShrink: 0, width: 36, textTransform: 'uppercase', fontWeight: 700, fontSize: 10 }}>{log.level}</span>
            <span style={{ color: '#64748b', flexShrink: 0, width: 80 }}>[{log.category || 'system'}]</span>
            <span style={{ color: '#e2e8f0' }}>{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}