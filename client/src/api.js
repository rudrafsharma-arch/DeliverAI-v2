const BASE = 'http://localhost:3005';

export const api = {
  get: (url) => fetch(BASE + url).then(r => r.json()),
  post: (url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(BASE + url, { method: 'DELETE' }).then(r => r.json()),
  stream: (url, onEvent) => {
    const es = new EventSource(BASE + url);
    es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch(err) {} };
    es.onerror = () => es.close();
    return es;
  },
  streamPost: (url, body, onEvent) => {
    return fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => {
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const read = () => reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onEvent(JSON.parse(line.slice(6))); } catch(e) {}
            }
          }
          read();
        });
        read();
      });
  }
};

export const BASE_URL = BASE;