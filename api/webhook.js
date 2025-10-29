import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const payload = req.body;

  console.log('Webhook received:', payload);

  // Build Tapfiliate conversion data
  const conversionData = {
    program_id: process.env.TAPFILIATE_PROGRAM_ID,
    amount: payload.total_amount || 0,  // pull from Fourthwall payload
    external_id: payload.id || `order-${Date.now()}`, // order ID fallback
    customer_email: payload.email || 'unknown@example.com' // customer email fallback
  };

  try {
    const tapResponse = await fetch('https://api.tapfiliate.com/1.6/conversions/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.TAPFILIATE_KEY
      },
      body: JSON.stringify(conversionData)
    });

    const tapResult = await tapResponse.json();
    console.log('Tapfiliate response:', tapResult);

    res.status(200).json({ status: 'success', tapfiliate: tapResult });
  } catch (err) {
    console.error('Error sending to Tapfiliate:', err);
    res.status(500).json({ error: 'Tapfiliate request failed' });
  }
}
