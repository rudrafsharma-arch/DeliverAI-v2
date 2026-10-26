import React, { useState, useEffect } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';
const GREEN = '#16a34a';
const RED = '#dc2626';

export default function Settings({ projects, setProjects, setProject }) {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', client: '', type: 'S/4HANA Public Cloud', description: '' });
  const [showNewProject, setShowNewProject] = useState(false);
  const [section, setSection] = useState('ai');
  const sf = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  useEffect(() => {
    api.get('/api/settings').then(setSettings).catch(() => {});
    api.get('/api/connectors').then(setConnectors).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    await api.post('/api/settings', settings);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  async function test() {
    setTesting(true); setTestResult(null);
    const r = await api.post('/api/settings/test', { engine: settings.aiEngine, key: settings.aiEngine === 'groq' ? settings.groqKey : settings.aiEngine === 'gemini' ? settings.geminiKey : settings.anthropicKey });
    setTestResult(r); setTesting(false);
  }

  async function createProject() {
    const p = await api.post('/api/projects', newProject);
    setProjects(ps => [p, ...ps]);
    setProject(p);
    setShowNewProject(false);
    setNewProject({ name: '', client: '', type: 'S/4HANA Public Cloud', description: '' });
  }

  const sections = [
    { id: 'ai', label: '🤖 AI Engine' },
    { id: 'projects', label: '📁 Projects' },
    { id: 'connectors', label: '🔌 Connectors' },
    { id: 'architect', label: '🧠 Architect' },
  ];

  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: 'none', background: section === s.id ? '#e8f2ff' : 'none', color: section === s.id ? BLUE : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: section === s.id ? 600 : 400, marginBottom: 4 }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {section === 'ai' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>AI Engine</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Choose which AI provider powers your agents. Claude Code CLI uses your Accenture subscription.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Provider</label>
              <select value={settings.aiEngine || 'claude-code-cli'} onChange={e => sf('aiEngine', e.target.value)} style={{ ...inp }}>
                {(settings.engines || [{ id: 'claude-code-cli', name: 'Claude Code CLI (Accenture)' }, { id: 'groq', name: 'Groq (Free)' }, { id: 'gemini', name: 'Google Gemini' }, { id: 'anthropic', name: 'Anthropic API' }, { id: 'azure-openai', name: 'Azure OpenAI' }]).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            {settings.aiEngine === 'groq' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Groq API Key</label>
                <input type="password" value={settings.groqKey || ''} onChange={e => sf('groqKey', e.target.value)} placeholder={settings.groqKey === '***set***' ? 'Key saved — leave blank to keep' : 'gsk_...'} style={inp} />
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, marginTop: 10 }}>Model</label>
                <input value={settings.groqModel || 'qwen/qwen3.8-27b'} onChange={e => sf('groqModel', e.target.value)} style={inp} />
              </div>
            )}
            {settings.aiEngine === 'gemini' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Gemini API Key</label>
                <input type="password" value={settings.geminiKey || ''} onChange={e => sf('geminiKey', e.target.value)} placeholder={settings.geminiKey === '***set***' ? 'Key saved — leave blank to keep' : 'AIza...'} style={inp} />
              </div>
            )}
            {settings.aiEngine === 'anthropic' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Anthropic API Key</label>
                <input type="password" value={settings.anthropicKey || ''} onChange={e => sf('anthropicKey', e.target.value)} placeholder={settings.anthropicKey === '***set***' ? 'Key saved — leave blank to keep' : 'sk-ant-...'} style={inp} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Parallel Agents (API mode)</label>
              <input type="number" value={settings.concurrency || 10} onChange={e => sf('concurrency', e.target.value)} min={1} max={50} style={{ ...inp, width: 100 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={test} disabled={testing} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>{testing ? 'Testing...' : 'Test Connection'}</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saved ? GREEN : BLUE, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}</button>
            </div>
            {testResult && <p style={{ marginTop: 10, fontSize: 13, color: testResult.success ? GREEN : RED }}>{testResult.success ? '✅' : '❌'} {testResult.message}</p>}
          </div>
        )}

        {section === 'projects' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Projects</h3>
              <button onClick={() => setShowNewProject(s => !s)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ New Project</button>
            </div>
            {showNewProject && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['name', 'Project Name', true], ['client', 'Client', false], ['type', 'Type', false], ['description', 'Description', false]].map(([k, label, req]) => (
                  <div key={k} style={{ gridColumn: k === 'description' ? '1 / -1' : 'auto' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{label}{req ? ' *' : ''}</label>
                    <input value={newProject[k]} onChange={e => setNewProject(p => ({ ...p, [k]: e.target.value }))} style={inp} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button onClick={createProject} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Create</button>
                  <button onClick={() => setShowNewProject(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            )}
            {projects.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.client} • {p.type}</div>
                </div>
                <button onClick={() => setProject(p)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 11 }}>Select</button>
              </div>
            ))}
          </div>
        )}

        {section === 'connectors' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Connectors</h3>
            {connectors.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.status === 'connected' ? GREEN : '#cbd5e1' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.type} • {c.status}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.status === 'connected' ? GREEN : '#94a3b8' }}>{c.status === 'connected' ? '✅ Connected' : 'Not connected'}</div>
              </div>
            ))}
          </div>
        )}

        {section === 'architect' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Architect Settings</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Auto-answer confidence threshold (%)</label>
              <input type="number" value={settings.confidenceThreshold || 80} onChange={e => sf('confidenceThreshold', e.target.value)} min={0} max={100} style={{ ...inp, width: 100 }} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Above this % Architect answers automatically. Below it escalates to you.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Log Level</label>
              <select value={settings.logLevel || 'info'} onChange={e => sf('logLevel', e.target.value)} style={inp}>
                <option value="debug">Debug (everything)</option>
                <option value="info">Info (default)</option>
                <option value="warn">Warn + Error</option>
                <option value="error">Error only</option>
              </select>
            </div>
            <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saved ? GREEN : BLUE, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}