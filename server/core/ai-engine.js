const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../observability/logger');

async function callAI(prompt, systemPrompt = '', options = {}) {
  const engine = options.engine || process.env.AI_ENGINE || 'claude-code-cli';
  logger.info(`Calling AI engine: ${engine}`, { category: 'ai-engine', metadata: { engine, model: options.model } });
  try {
    if (engine === 'groq' && process.env.GROQ_API_KEY) return await callGroq(prompt, systemPrompt, options);
    if (engine === 'gemini' && process.env.GEMINI_API_KEY) return await callGemini(prompt, systemPrompt, options);
    if (engine === 'anthropic' && process.env.ANTHROPIC_API_KEY) return await callAnthropic(prompt, systemPrompt, options);
    if (engine === 'azure-openai' && process.env.AZURE_OPENAI_KEY) return await callAzure(prompt, systemPrompt, options);
    if (engine === 'sap-ai-core' && process.env.SAP_AI_CORE_KEY) return await callSAPAICore(prompt, systemPrompt, options);
    return await callClaudeCLI(prompt, systemPrompt, options);
  } catch(e) {
    logger.error(`AI engine error: ${e.message}`, { category: 'ai-engine', metadata: { engine, error: e.message } });
    throw e;
  }
}

async function callGroq(prompt, systemPrompt, options) {
  const model = options.model || process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model, max_tokens: options.maxTokens || 8000,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) throw new Error(`Groq error: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt, systemPrompt, options) {
  const model = options.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const contents = [];
  if (systemPrompt) contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: options.maxTokens || 8000 } })
  });
  if (!r.ok) throw new Error(`Gemini error: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callAnthropic(prompt, systemPrompt, options) {
  const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: options.maxTokens || 8000,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error(`Anthropic error: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.content?.map(c => c.text || '').join('') || '';
}

async function callAzure(prompt, systemPrompt, options) {
  const deployment = options.model || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const r = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY },
    body: JSON.stringify({
      max_tokens: options.maxTokens || 8000,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) throw new Error(`Azure error: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

async function callSAPAICore(prompt, systemPrompt, options) {
  const endpoint = process.env.SAP_AI_CORE_ENDPOINT;
  const deployment = process.env.SAP_AI_CORE_DEPLOYMENT;
  const r = await fetch(`${endpoint}/v2/inference/deployments/${deployment}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SAP_AI_CORE_KEY}`, 'AI-Resource-Group': 'default' },
    body: JSON.stringify({
      max_tokens: options.maxTokens || 8000,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) throw new Error(`SAP AI Core error: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

function callClaudeCLI(prompt, systemPrompt, options) {
  return new Promise((resolve, reject) => {
    const gitBash = process.env.GIT_BASH_PATH;
    const claudePath = process.env.CLAUDE_PATH;
    if (!gitBash || !claudePath) return reject(new Error('Claude CLI not configured'));
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const tmpFile = path.join(process.env.DATA_DIR || './data', `.prompt-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, fullPrompt);
    const proc = spawn('powershell.exe', ['-Command', `Get-Content "${tmpFile}" | ${claudePath} --print --dangerously-skip-permissions`], { env: process.env });
    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => logger.debug(d.toString(), { category: 'claude-cli' }));
    proc.on('close', () => { try { fs.unlinkSync(tmpFile); } catch(e) {} resolve(output); });
    proc.on('error', reject);
  });
}

function getActiveEngine() {
  const e = process.env.AI_ENGINE || 'claude-code-cli';
  if (e === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (e === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (e === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (e === 'azure-openai' && process.env.AZURE_OPENAI_KEY) return 'azure-openai';
  if (e === 'sap-ai-core' && process.env.SAP_AI_CORE_KEY) return 'sap-ai-core';
  return 'claude-code-cli';
}

const ENGINES = [
  { id: 'claude-code-cli', name: 'Claude Code CLI (Accenture)', requiresKey: false },
  { id: 'groq', name: 'Groq (Free)', requiresKey: true, keyEnv: 'GROQ_API_KEY', models: ['qwen/qwen3.8-27b', 'llama-3.3-70b-versatile'] },
  { id: 'gemini', name: 'Google Gemini', requiresKey: true, keyEnv: 'GEMINI_API_KEY', models: ['gemini-3.5-flash', 'gemini-1.5-pro'] },
  { id: 'anthropic', name: 'Anthropic API', requiresKey: true, keyEnv: 'ANTHROPIC_API_KEY', models: ['claude-sonnet-4-6', 'claude-opus-4-5'] },
  { id: 'azure-openai', name: 'Azure OpenAI', requiresKey: true, keyEnv: 'AZURE_OPENAI_KEY', models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'sap-ai-core', name: 'SAP AI Core', requiresKey: true, keyEnv: 'SAP_AI_CORE_KEY', models: ['gpt-4o', 'claude-3-sonnet'] }
];

module.exports = { callAI, getActiveEngine, ENGINES };