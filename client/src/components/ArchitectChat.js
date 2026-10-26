import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const BLUE = '#0070F2';

export default function ArchitectChat({ project, questions, setQuestions }) {
  const [messages, setMessages] = useState([{
    role: 'architect',
    content: 'Hello! I am the Architect. I can help you plan, run agents, analyze documents, and manage your BTP platform. What would you like to do?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role === 'architect' ? 'assistant' : 'user', content: m.content }));
      let response = '';
      await api.streamPost('/api/architect/chat', { message: userMsg, projectId: project?.id, history }, (event) => {
        if (event.type === 'complete') response = event.message;
        if (event.type === 'status') setMessages(m => {
          const last = m[m.length - 1];
          if (last?.role === 'architect-thinking') return [...m.slice(0, -1), { role: 'architect-thinking', content: event.message }];
          return [...m, { role: 'architect-thinking', content: event.message }];
        });
      });
      setMessages(m => {
        const filtered = m.filter(x => x.role !== 'architect-thinking');
        return [...filtered, { role: 'architect', content: response || 'I processed your request.' }];
      });
    } catch(e) {
      setMessages(m => [...m, { role: 'architect', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  }

  async function answerQuestion(questionId, answer) {
    await api.post('/api/architect/answer', { questionId, answer });
    setQuestions(q => q.filter(x => x.id !== questionId));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>ðŸ¤–</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Architect</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Always on â€¢ {project ? project.name : 'No project'}</div>
        </div>
        <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
      </div>

      {/* Pending questions */}
      {questions.length > 0 && (
        <div style={{ padding: 12, background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          {questions.map(q => (
            <div key={q.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                â“ {q.agentId}: {q.question}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(q.options || []).map(opt => (
                  <button key={opt} onClick={() => answerQuestion(q.id, opt)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fde68a', background: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                    {opt}
                  </button>
                ))}
                <input placeholder="Custom answer..." onKeyDown={e => { if (e.key === 'Enter') answerQuestion(q.id, e.target.value); }}
                  style={{ flex: 1, minWidth: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
              background: m.role === 'user' ? BLUE : m.role === 'architect-thinking' ? '#f1f5f9' : '#fff',
              color: m.role === 'user' ? '#fff' : '#1e293b',
              border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
              fontStyle: m.role === 'architect-thinking' ? 'italic' : 'normal'
            }}>
              {m.role === 'architect-thinking' ? `âŒ› ${m.content}` : m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 11, color: '#94a3b8', padding: '4px 0' }}>âŒ› Architect thinking...</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask Architect anything..." disabled={loading}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
          â†‘
        </button>
      </div>
    </div>
  );
}

