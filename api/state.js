// /api/state - in-memory state store
// Vercel serverless can't write to /tmp reliably (read-only filesystem),
// so we keep state in module scope (lasts for the lifetime of the function instance).

let state = {};

function loadState() {
  return state;
}
function saveState(s) {
  state = { ...s };
  return true;
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ state: loadState() });
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad request' });
    const ok = saveState({ ...body, updatedAt: new Date().toISOString() });
    if (!ok) return res.status(500).json({ error: 'persist failed' });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'method not allowed' });
};
