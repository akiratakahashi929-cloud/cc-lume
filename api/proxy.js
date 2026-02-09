export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const gasUrl = 'https://script.google.com/macros/s/AKfycbyARAuxDvgIRAH3-K9peyYTO0kdMuccij2Udkld46plyrOAeFqpFv00MfBF6GsAwnq6/exec';

  try {
    // GASのPOSTは一度302リダイレクトを挟むため、Node.jsのfetchで確実にPOSTを維持する
    let response = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow', // デフォルトはfollowだが明示
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
    });

    // もしリダイレクト先がGETに化けてHTMLが返ってきた場合への対策 (GASの仕様)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      console.error('GAS returned HTML instead of JSON. Redirect might have failed to maintain POST.');
      return res.status(500).json({ success: false, error: 'Target API endpoint did not return JSON. (CORS/Redirect issue)' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message });
  }
}
