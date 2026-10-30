export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const gasUrl = process.env.GAS_URL;
  if (!gasUrl) return res.status(500).json({ ok: false, error: 'Environment variable GAS_URL belum diatur di Vercel.' });
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body || {})
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('Respons Apps Script bukan JSON. Periksa URL deployment dan izin akses.'); }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Gagal menghubungi Apps Script.' });
  }
}
