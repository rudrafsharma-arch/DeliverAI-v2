import React, { useState, useEffect } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';

export default function Activity({ project }) {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const load = () => api.get(`/api/jobs?projectId=${project?.id || ''}&limit=50`).then(setJobs).catch(() => {});
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [project?.id]);

  useEffect(() => {
    if (selected) {
      api.get(`/api/logs?jobId=${selected.id}&limit=200`).then(setLogs).catch(() => {});
    }
  }, [selected?.id]);

  const statusColor = { pending: '#94a3b8', running: '#3b82f6', completed: '#16a34a', failed: '#dc2626', cancelled: '#f59e0b' };
  const statusIcon = { pending: '⏳', running: '🔄', completed: '✅', failed: '❌', cancelled: '⚠️' };

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 120px)' }}>
      {/* Job list */}
      <div style={{ width: 380, flexShrink: 0, overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Activity</h2>
        {jobs.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No jobs yet. Run an agent to get started.</div>}
        {jobs.map(job => (
          <div key={job.id} onClick={() => setSelected(job)}
            style={{ background: '#fff', border: `1px solid ${selected?.id === job.id ? BLUE : '#e2e8f0'}`, borderRadius: 10, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{statusIcon[job.status] || '?'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{job.agent_name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(job.created_at).toLocaleString()}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: statusColor[job.status] || '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: 6 }}>
                {job.status}
              </div>
            </div>
            {job.status === 'running' && (
              <div style={{ marginTop: 8, height: 3, background: '#e2e8f0', borderRadius: 2 }}>
                <div style={{ height: '100%', background: BLUE, borderRadius: 2, animation: 'pulse 1.5s infinite', width: '60%' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Job detail */}
      <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.agent_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Job: {selected.id} • Mode: {selected.mode}</div>
              </div>
              {selected.status === 'completed' && (
                <button onClick={async () => {
                  const docs = await api.get(`/api/documents?agentId=${selected.agent_id}&projectId=${project?.id || ''}`);
                  if (docs[0]) { const d = await api.get(`/api/documents/${docs[0].id}`); if (d.content) { const w = window.open(); w.document.write(d.content); } }
                }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Open Document</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b', marginBottom: 8 }}>LOGS</div>
              {logs.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No logs for this job</div> : null}
              {logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 4, fontSize: 12 }}>
                  <div style={{ color: '#94a3b8', flexShrink: 0 }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                  <div style={{ width: 48, flexShrink: 0, fontWeight: 600, color: log.level === 'error' ? '#dc2626' : log.level === 'warn' ? '#f59e0b' : '#64748b', textTransform: 'uppercase', fontSize: 10 }}>{log.level}</div>
                  <div style={{ color: '#1e293b' }}>{log.message}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 14 }}>
            Select a job to see details and logs
          </div>
        )}
      </div>
    </div>
  );
}