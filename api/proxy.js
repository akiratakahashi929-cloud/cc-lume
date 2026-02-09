export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const gasUrl = 'https://script.google.com/macros/s/AKfycbyARAuxDvgIRAH3-K9peyYTO0kdMuccij2Udkld46plyrOAeFqpFv00MfBF6GsAwnq6/exec';

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
