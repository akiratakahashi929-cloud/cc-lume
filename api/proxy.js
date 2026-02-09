export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const gasUrl = 'https://script.google.com/macros/s/AKfycbyARAuxDvgIRAH3-K9peyYTO0kdMuccij2Udkld46plyrOAeFqpFv00MfBF6GsAwnq6/exec';

  try {
    // 1. 初回のPOSTリクエスト（redirect: 'manual' でリダイレクトURLを捕まえる）
    let response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual'
    });

    // 2. 302リダイレクトが発生した場合、リダイレクト先から結果をGETで取得する（GASの仕様）
    // GASは一旦リダイレクトさせるが、そのリダイレクト先をGETすることで結果が得られる
    if (response.status === 302) {
      const redirectUrl = response.headers.get('location');
      response = await fetch(redirectUrl);
    }

    // 3. レスポンスの取得と返却
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      const text = await response.text();
      // HTMLが返ってきてしまった場合はエラーとして詳細を返す
      console.error('GAS returned non-JSON:', text.substring(0, 100));
      res.status(500).json({
        success: false,
        error: 'Target API endpoint did not return JSON.',
        detail: text.substring(0, 200)
      });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message });
  }
}
