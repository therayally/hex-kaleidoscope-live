// /api/state - in-memory state store (pure ESM)
let state = {};

function loadState() {
  return state;
}
function saveState(s) {
  state = { ...s };
  return true;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ state: loadState() });
  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: 'bad json' });
    }
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad request' });
    saveState({ ...body, updatedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'method not allowed' });
}
