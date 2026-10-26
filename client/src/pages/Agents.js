import React, { useState, useEffect, useRef } from 'react';
import { api, BASE_URL } from '../api';

const BLUE = '#0070F2';
const PHASE_COLORS = { discover: '#3b82f6', prepare: '#8b5cf6', explore: '#10b981', realize: '#f59e0b', test: '#eab308', deploy: '#ef4444', run: '#06b6d4' };

export default function Agents({ project }) {
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [step, setStep] = useState('list');
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const fileRef = useRef();
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { api.get('/api/agents').then(setAgents).catch(() => {}); }, []);

  const phases = ['all', 'discover', 'prepare', 'explore', 'realize', 'test', 'deploy', 'run'];
  const filtered = agents.filter(a => {
    if (filter !== 'all' && a.phase !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openAgent(agent) {
    setSelected(agent);
    setForm({ projectName: project?.name || '', client: project?.client || '', processName: '', description: '' });
    setUploadedFile(null);
    setShowPrompt(false);
    setStep('form');
    // Load prompt
    api.get(`/api/agents/${agent.id}`).then(d => setPrompt(d.prompt || '')).catch(() => {});
  }

  async function savePrompt() {
    setSavingPrompt(true);
    await api.put(`/api/agents/${selected.id}/prompt`, { prompt });
    setSavingPrompt(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 3000);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedFile({ name: file.name, content: ev.target.result, type: file.type });
    };
    reader.readAsText(file);
  }

  async function runAgent() {
    if (!selected) return;
    setStep('running'); setLogs([]); setResult(null);
    const formData = { ...form };
    if (uploadedFile) formData.uploadedFile = uploadedFile;
    const isBTP = selected.id === 'btp-admin-agent';
    if (isBTP) {
      const url = `${BASE_URL}/api/btp/run?task=${encodeURIComponent(form.task || form.description || '')}&projectId=${project?.id || ''}`;
      const es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          setLogs(l => [...l, d]);
          if (d.type === 'complete') { setResult(d); es.close(); setStep('done'); }
          if (d.type === 'error') { setLogs(l => [...l, { type: 'error', message: d.message }]); es.close(); setStep('done'); }
        } catch(err) {}
      };
      es.onerror = () => { es.close(); setStep('done'); };
    } else {
      try {
        const { jobId } = await api.post('/api/run', { agentId: selected.id, projectId: project?.id, formData });
        setLogs(l => [...l, { type: 'status', message: `Job started: ${jobId}` }]);
        await new Promise(resolve => setTimeout(resolve, 500));
        const es = new EventSource(`${BASE_URL}/api/run/${jobId}/stream`);
        es.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            setLogs(l => [...l, d]);
            if (d.type === 'complete') { setResult(d); es.close(); setStep('done'); }
            if (d.type === 'error') { es.close(); setStep('done'); }
          } catch(err) {}
        };
        es.onerror = () => { es.close(); setStep('done'); };
      } catch(e) {
        setLogs(l => [...l, { type: 'error', message: e.message }]);
        setStep('done');
      }
    }
  }

  function downloadHtml(html, name) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name || 'document.html';
    a.click(); URL.revokeObjectURL(url);
  }

  // â”€â”€ Prompt Editor Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (showPrompt && selected) return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => setShowPrompt(false)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>â† Back to Form</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.name} â€” Edit Prompt</span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>
          This is the system prompt that guides the agent. Changes take effect on next run.
        </div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={25}
          style={{ width: '100%', padding: 16, fontSize: 12, fontFamily: 'monospace', border: 'none', resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
          placeholder="Loading prompt..." />
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={savePrompt} disabled={savingPrompt}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: promptSaved ? '#16a34a' : BLUE, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {savingPrompt ? 'Saving...' : promptSaved ? 'âœ… Saved!' : 'Save Prompt'}
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{prompt.length} characters</span>
        </div>
      </div>
    </div>
  );

  // â”€â”€ Agent Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === 'form' && selected) return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => { setStep('list'); setSelected(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>â† Back</button>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{selected.name}</span>
        <button onClick={() => setShowPrompt(true)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>
          âœï¸ Edit Prompt
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>{selected.icon || 'ðŸ¤–'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selected.description}</div>
          </div>
        </div>

        {selected.id !== 'btp-admin-agent' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {[
              { id: 'projectName', label: 'Project Name', required: true, placeholder: 'e.g. Mars S4 Migration' },
              { id: 'client', label: 'Client', placeholder: 'e.g. Mars Inc.' },
              { id: 'processName', label: 'Process / Topic', required: true, placeholder: 'e.g. Vendor Invoice' },
              { id: 'preparedBy', label: 'Prepared By', placeholder: 'Your name' }
            ].map(f => (
              <div key={f.id}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>{f.label}{f.required ? ' *' : ''}</label>
                <input value={form[f.id] || ''} onChange={e => sf(f.id, e.target.value)} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        )}

        {selected.id === 'btp-admin-agent' ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>What do you want to do on BTP? *</label>
            <textarea value={form.task || ''} onChange={e => sf('task', e.target.value)} rows={4}
              placeholder="e.g. Assign PI_Administrator role to vikram.f.sharma@gmail.com"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Description / Key Details *</label>
            <textarea value={form.description || ''} onChange={e => sf('description', e.target.value)} rows={5}
              placeholder="Describe the process, requirements, business rules, integration points..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* File Upload */}
        <div style={{ marginBottom: 16, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 8 }}>ðŸ“Ž Attach File (optional)</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>Upload a PDF, Word doc, Excel, or text file to give the agent additional context.</div>
          <input type="file" ref={fileRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.md"
            style={{ display: 'none' }} />
          {uploadedFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#1e293b' }}>ðŸ“„ {uploadedFile.name}</span>
              <button onClick={() => setUploadedFile(null)} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>Remove</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()}
              style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Choose File
            </button>
          )}
        </div>

        <button onClick={runAgent}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          Generate â†’
        </button>
      </div>
    </div>
  );

  // â”€â”€ Running / Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === 'running' || step === 'done') return (
    <div style={{ maxWidth: 700 }}>
      {step === 'done' && (
        <button onClick={() => { setStep('list'); setSelected(null); setResult(null); setLogs([]); }}
          style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>â† Back</button>
      )}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          {selected?.name} {step === 'running' ? 'ðŸ”„ Running...' : 'âœ… Complete'}
        </div>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
          {logs.map((l, i) => (
            <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', color: l.type === 'error' ? '#f87171' : l.type === 'action' ? '#fbbf24' : '#4ade80', marginBottom: 2 }}>
              {l.type === 'error' ? 'âŒ' : l.type === 'action' ? 'âš¡' : '>'} {l.message || l.text || l.step || JSON.stringify(l)}
            </div>
          ))}
          {step === 'running' && <div style={{ color: '#94a3b8', fontSize: 12 }}>â–‹</div>}
        </div>
        {result?.html && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { const w = window.open(); w.document.write(result.html); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ðŸ“„ Open Document
            </button>
            <button onClick={() => downloadHtml(result.html, `${selected?.id}_result.html`)}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              â¬‡ï¸ Download HTML
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // â”€â”€ Agent List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Agents</h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>{agents.length} agents available{project ? ` Â· ${project.name}` : ''}</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..."
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, width: 220, outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {phases.map(p => (
          <button key={p} onClick={() => setFilter(p)}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: filter === p ? (PHASE_COLORS[p] || BLUE) : '#f1f5f9', color: filter === p ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: filter === p ? 600 : 400, textTransform: 'capitalize' }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(agent => (
          <div key={agent.id}
            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{agent.icon || 'ðŸ¤–'}</span>
              <div style={{ flex: 1 }} onClick={() => openAgent(agent)}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>{agent.phase || 'general'}</div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PHASE_COLORS[agent.phase] || '#94a3b8', flexShrink: 0, marginTop: 4 }} />
            </div>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 12px' }} onClick={() => openAgent(agent)}>
              {(agent.description || '').substring(0, 100)}{agent.description?.length > 100 ? '...' : ''}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openAgent(agent)}
                style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Generate
              </button>
              <button onClick={(e) => { e.stopPropagation(); setSelected(agent); api.get(`/api/agents/${agent.id}`).then(d => setPrompt(d.prompt || '')).catch(() => {}); setShowPrompt(true); setStep('form'); }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12 }} title="Edit Prompt">
                âœï¸
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
