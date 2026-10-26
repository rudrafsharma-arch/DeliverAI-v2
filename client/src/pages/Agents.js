import React, { useState, useEffect } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';
const PHASE_COLORS = { discover: '#3b82f6', prepare: '#8b5cf6', explore: '#10b981', realize: '#f59e0b', test: '#eab308', deploy: '#ef4444', run: '#06b6d4' };

export default function Agents({ project }) {
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('list'); // list | form | running | done
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { api.get('/api/agents').then(setAgents).catch(() => {}); }, []);

  const phases = ['all', 'discover', 'prepare', 'explore', 'realize', 'test', 'deploy', 'run'];
  const filtered = agents.filter(a => {
    if (filter !== 'all' && a.phase !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function runAgent() {
    if (!selected) return;
    setStep('running'); setLogs([]); setResult(null);
    const isBTP = selected.id === 'btp-admin-agent';
    const url = isBTP
      ? `/api/btp/run?task=${encodeURIComponent(form.task || form.description || '')}&projectId=${project?.id || ''}`
      : null;
    if (isBTP) {
      const es = new EventSource('http://localhost:3005' + url);
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          setLogs(l => [...l, d]);
          if (d.type === 'complete') { setResult(d); es.close(); setStep('done'); }
          if (d.type === 'error') { setLogs(l => [...l, { type: 'error', message: d.message }]); es.close(); setStep('done'); }
        } catch(err) {}
      };
    } else {
      try {
        const { jobId } = await api.post('/api/run', { agentId: selected.id, projectId: project?.id, formData: form });
        setLogs(l => [...l, { type: 'status', message: `Job queued: ${jobId}` }]);
        const es = new EventSource(`http://localhost:3005/api/run/${jobId}/stream`);
        es.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            setLogs(l => [...l, d]);
            if (d.type === 'complete') { setResult(d); es.close(); setStep('done'); }
            if (d.type === 'error') { es.close(); setStep('done'); }
          } catch(err) {}
        };
      } catch(e) { setLogs(l => [...l, { type: 'error', message: e.message }]); setStep('done'); }
    }
  }

  if (step === 'form' && selected) return (
    <div style={{ maxWidth: 700 }}>
      <button onClick={() => { setStep('list'); setSelected(null); }} style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 28 }}>{selected.icon || '🤖'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selected.description}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {(selected.id === 'btp-admin-agent' ? [] : [
            { id: 'projectName', label: 'Project Name', required: true, placeholder: 'e.g. Mars S4 Migration' },
            { id: 'client', label: 'Client', placeholder: 'e.g. Mars Inc.' },
            { id: 'processName', label: 'Process / Topic', required: true, placeholder: 'e.g. Vendor Invoice' },
            { id: 'preparedBy', label: 'Prepared By', placeholder: 'Your name' }
          ]).map(f => (
            <div key={f.id}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>{f.label}{f.required ? ' *' : ''}</label>
              <input value={form[f.id] || ''} onChange={e => sf(f.id, e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        {selected.id === 'btp-admin-agent' ? (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>What do you want to do on BTP? *</label>
            <textarea value={form.task || ''} onChange={e => sf('task', e.target.value)} rows={4}
              placeholder="e.g. Assign PI_Administrator role to vikram.f.sharma@gmail.com"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Description / Key Details *</label>
            <textarea value={form.description || ''} onChange={e => sf('description', e.target.value)} rows={5}
              placeholder="Describe the process, requirements, business rules, integration points..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        <button onClick={runAgent} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 10, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          Generate →
        </button>
      </div>
    </div>
  );

  if (step === 'running' || step === 'done') return (
    <div style={{ maxWidth: 700 }}>
      {step === 'done' && <button onClick={() => { setStep('list'); setSelected(null); setResult(null); setLogs([]); }} style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{selected?.name} {step === 'running' ? '🔄 Running...' : '✅ Complete'}</div>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
          {logs.map((l, i) => (
            <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', color: l.type === 'error' ? '#f87171' : l.type === 'action' ? '#fbbf24' : '#4ade80', marginBottom: 2 }}>
              {l.type === 'error' ? '❌' : l.type === 'action' ? '⚡' : '>'} {l.message || l.text || l.step || JSON.stringify(l)}
            </div>
          ))}
          {step === 'running' && <div style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', animation: 'pulse 1s infinite' }}>▋</div>}
        </div>
        {result?.html && (
          <button onClick={() => { const w = window.open(); w.document.write(result.html); }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            📄 Open Document
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Agents</h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>{agents.length} agents available</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..."
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, width: 220, outline: 'none' }} />
      </div>
      {/* Phase filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {phases.map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: filter === p ? (PHASE_COLORS[p] || BLUE) : '#f1f5f9', color: filter === p ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: filter === p ? 600 : 400, textTransform: 'capitalize' }}>
            {p}
          </button>
        ))}
      </div>
      {/* Agent grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(agent => (
          <div key={agent.id} onClick={() => { setSelected(agent); setForm({ projectName: '', client: '', processName: '', description: '' }); setStep('form'); }}
            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{agent.icon || '🤖'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>{agent.phase || 'general'}</div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PHASE_COLORS[agent.phase] || '#94a3b8', flexShrink: 0 }} />
            </div>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{(agent.description || '').substring(0, 100)}{agent.description?.length > 100 ? '...' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}