export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const gasUrl = 'https://script.google.com/macros/s/AKfycbyARAuxDvgIRAH3-K9peyYTO0kdMuccij2Udkld46plyrOAeFqpFv00MfBF6GsAwnq6/exec';

  console.log('--- Proxy Request Start ---');
  console.log('Action:', req.body.action);

  try {
    // 1. 初回のPOSTリクエスト
    console.log('Fetching GAS (POST)...');
    let response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual'
    });

    console.log('GAS Initial Status:', response.status);

    // 2. 302リダイレクトが発生した場合
    if (response.status === 302) {
      const redirectUrl = response.headers.get('location');
      console.log('GAS Redirect Location:', redirectUrl);
      response = await fetch(redirectUrl);
      console.log('GAS Final Status:', response.status);
    }

    // 3. レスポンスの取得
    const contentType = response.headers.get('content-type');
    console.log('GAS Response Content-Type:', contentType);

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('GAS JSON Success:', data.success);
      res.status(200).json(data);
    } else {
      const text = await response.text();
      console.error('GAS returned non-JSON. Length:', text.length);
      console.error('Content Preview:', text.substring(0, 200));
      res.status(500).json({
        success: false,
        error: 'Target API endpoint did not return JSON.',
        detail: text.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message });
  }
}
