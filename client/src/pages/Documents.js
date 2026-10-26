import React, { useState, useEffect } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';

export default function Documents({ project }) {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    api.get(`/api/documents?projectId=${project?.id || ''}`).then(setDocs).catch(() => {});
  }, [project?.id]);

  async function openDoc(doc) {
    setSelected(doc);
    const d = await api.get(`/api/documents/${doc.id}`);
    setContent(d.content || '');
  }

  async function refine() {
    if (!selected || !refineInput.trim()) return;
    setRefining(true);
    await api.streamPost(`/api/documents/${selected.id}/refine`, { instruction: refineInput }, (event) => {
      if (event.type === 'complete' && event.html) setContent(event.html);
    });
    setRefining(false);
    setRefineInput('');
  }

  async function approve() {
    await api.put(`/api/documents/${selected.id}/approve`, { approvedBy: 'user' });
    setDocs(d => d.map(x => x.id === selected.id ? { ...x, status: 'approved' } : x));
    setSelected(s => ({ ...s, status: 'approved' }));
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 120px)' }}>
      {/* Document list */}
      <div style={{ width: 300, flexShrink: 0, overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Documents</h2>
        {docs.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No documents yet.</div>}
        {docs.map(doc => (
          <div key={doc.id} onClick={() => openDoc(doc)}
            style={{ background: '#fff', border: `1px solid ${selected?.id === doc.id ? BLUE : '#e2e8f0'}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', marginBottom: 2 }}>{doc.agent_name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>v{doc.version} • {new Date(doc.created_at).toLocaleDateString()}</div>
            <div style={{ fontSize: 10, marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: doc.status === 'approved' ? '#f0fdf4' : '#fef3c7', color: doc.status === 'approved' ? '#16a34a' : '#92400e', fontWeight: 600 }}>
              {doc.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Document viewer */}
      <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            {/* Quick refinements */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>Quick refinements:</span>
              {['Make more concise', 'Add more detail', 'Make formal', 'Add risk section', 'Add table of contents'].map(r => (
                <button key={r} onClick={() => { setRefineInput(r); }} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
            {/* Toolbar */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{selected.agent_name} v{selected.version}</div>
              <button onClick={() => { const w = window.open(); w.document.write(content); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer' }}>Open in Tab</button>
              {selected.status !== 'approved' && (
                <button onClick={approve} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Approve</button>
              )}
            </div>
            {/* Refine input */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
              <input value={refineInput} onChange={e => setRefineInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && refine()}
                placeholder="Refine instruction... (e.g. Add more detail to section 2)"
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
              <button onClick={refine} disabled={refining} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: BLUE, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: refining ? 0.6 : 1 }}>
                {refining ? 'Refining...' : 'Refine'}
              </button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <iframe srcDoc={content} style={{ width: '100%', height: '100%', border: 'none' }} title="document" />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 14 }}>
            Select a document to view and refine
          </div>
        )}
      </div>
    </div>
  );
}