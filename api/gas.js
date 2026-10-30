
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const gasUrl = process.env.GAS_URL;

  if (!gasUrl) {
    return res.status(500).json({
      ok: false,
      error: 'GAS_URL belum diatur di Vercel.'
    });
  }

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(req.body || {})
    });

    const result = await response.text();

    let data;
    try {
      data = JSON.parse(result);
    } catch (error) {
      throw new Error(
        'Respons Google Apps Script bukan JSON: ' +
        result.substring(0, 150)
      );
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error.message
    });
  }
}
