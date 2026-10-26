import React, { useState } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';

export default function StartupModal({ onDone }) {
  const [mode, setMode] = useState('claude-code-cli');
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [concurrency, setConcurrency] = useState(10);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function test() {
    setTesting(true); setTestResult(null);
    const r = await api.post('/api/settings/test', { engine: provider, key: apiKey });
    setTestResult(r); setTesting(false);
  }

  async function start() {
    setSaving(true);
    await api.post('/api/settings', {
      aiEngine: mode === 'cli' ? 'claude-code-cli' : provider,
      ...(provider === 'groq' && apiKey ? { groqKey: apiKey } : {}),
      ...(provider === 'gemini' && apiKey ? { geminiKey: apiKey } : {}),
      ...(provider === 'anthropic' && apiKey ? { anthropicKey: apiKey } : {}),
      concurrency: String(concurrency)
    });
    setSaving(false);
    onDone();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 480, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: BLUE, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24, margin: '0 auto 12px' }}>D</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>Welcome to DeliverAI</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Autonomous SAP Delivery Platform</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>How do you want to run agents?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 12, padding: 14, border: `2px solid ${mode === 'cli' ? BLUE : '#e2e8f0'}`, borderRadius: 10, cursor: 'pointer', background: mode === 'cli' ? '#e8f2ff' : '#fff' }}>
              <input type="radio" checked={mode === 'cli'} onChange={() => setMode('cli')} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Claude Code CLI</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Uses Accenture subscription. Sequential, one agent at a time. No API key needed.</div>
              </div>
            </label>
            <label style={{ display: 'flex', gap: 12, padding: 14, border: `2px solid ${mode === 'api' ? BLUE : '#e2e8f0'}`, borderRadius: 10, cursor: 'pointer', background: mode === 'api' ? '#e8f2ff' : '#fff' }}>
              <input type="radio" checked={mode === 'api'} onChange={() => setMode('api')} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>API Key</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Parallel agents, Architect-coordinated. Groq is free to start.</div>
              </div>
            </label>
          </div>
        </div>

        {mode === 'api' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>Provider</div>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 10 }}>
              <option value="groq">Groq (Free — no credit card)</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic</option>
              <option value="azure-openai">Azure OpenAI</option>
            </select>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'groq' ? 'gsk_...' : provider === 'gemini' ? 'AIza...' : 'sk-ant-...'}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Parallel agents:</span>
              <input type="number" value={concurrency} onChange={e => setConcurrency(e.target.value)} min={1} max={50}
                style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <button onClick={test} disabled={testing || !apiKey} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>
                {testing ? 'Testing...' : 'Test Key'}
              </button>
            </div>
            {testResult && <p style={{ marginTop: 8, fontSize: 12, color: testResult.success ? '#16a34a' : '#dc2626' }}>{testResult.success ? '✅' : '❌'} {testResult.message}</p>}
          </div>
        )}

        <button onClick={start} disabled={saving || (mode === 'api' && !apiKey)}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, opacity: (saving || (mode === 'api' && !apiKey)) ? 0.6 : 1 }}>
          {saving ? 'Starting...' : 'Start DeliverAI →'}
        </button>
      </div>
    </div>
  );
}