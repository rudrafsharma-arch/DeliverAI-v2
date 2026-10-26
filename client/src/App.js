import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import Agents from './pages/Agents';
import Activity from './pages/Activity';
import Documents from './pages/Documents';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import ArchitectChat from './components/ArchitectChat';
import StartupModal from './components/StartupModal';

const BLUE = '#0070F2';
const NAV = ['Agents', 'Activity', 'Documents', 'Logs', 'Settings'];

export default function App() {
  const [tab, setTab] = useState('Agents');
  const [engine, setEngine] = useState('...');
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showArchitect, setShowArchitect] = useState(false);
  const [showStartup, setShowStartup] = useState(false);
  const [questions, setQuestions] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    api.get('/api/health').then(d => setEngine(d.engine || '?')).catch(() => {});
    api.get('/api/projects').then(setProjects).catch(() => {});
    // Check if first time setup needed
    api.get('/api/settings').then(s => {
      if (!s.groqKey && !s.geminiKey && !s.anthropicKey && s.aiEngine === 'claude-code-cli') {
        // CLI mode - no setup needed
      }
    }).catch(() => {});
    // WebSocket for real-time updates
    connectWS();
  }, []);

  function connectWS() {
    try {
      const socket = new WebSocket('ws://localhost:3005');
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'connected') setEngine(data.engine || '?');
          if (data.type === 'architect:question') setQuestions(q => [...q, data]);
          if (data.type === 'architect:answered') setQuestions(q => q.filter(x => x.id !== data.questionId));
        } catch(err) {}
      };
      socket.onclose = () => setTimeout(connectWS, 3000);
      ws.current = socket;
    } catch(e) {}
  }

  const tabs = { Agents, Activity, Documents, Logs, Settings };
  const TabComponent = tabs[tab];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 24, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
          <div style={{ width: 32, height: 32, background: BLUE, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>D</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>DeliverAI</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>v2.0</div>
          </div>
        </div>
        {/* Nav */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: tab === t ? '#e8f2ff' : 'none', color: tab === t ? BLUE : '#64748b', fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontSize: 13 }}>{t}</button>
          ))}
        </div>
        {/* Project selector */}
        <select value={project?.id || ''} onChange={e => setProject(projects.find(p => p.id === e.target.value) || null)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, maxWidth: 200 }}>
          <option value=''>No project selected</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {/* Engine badge */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
          {engine}
        </div>
        {/* Architect button */}
        <button onClick={() => setShowArchitect(s => !s)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: showArchitect ? BLUE : '#f1f5f9', color: showArchitect ? '#fff' : '#1e293b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ðŸ¤– Architect
        </button>
        {/* Questions badge */}
        {questions.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#92400e', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowArchitect(true)}>
            â“ {questions.length} question{questions.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <TabComponent project={project} projects={projects} setProjects={setProjects} setProject={setProject} />
        </div>
        {/* Architect panel */}
        {showArchitect && (
          <div style={{ width: 380, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', position: 'sticky', top: 56 }}>
            <ArchitectChat project={project} questions={questions} setQuestions={setQuestions} />
          </div>
        )}
      </div>
    </div>
  );
}

