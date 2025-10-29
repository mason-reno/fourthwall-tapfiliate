import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-fourthwall-signature'];

  // Optional: skip HMAC check in test mode
  if (!req.body.testMode) {
    if (!process.env.FOURTHWALL_HMAC_SECRET) {
      console.warn('HMAC secret not set!');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const hmac = crypto.createHmac('sha256', process.env.FOURTHWALL_HMAC_SECRET);
    hmac.update(payload);
    const digest = hmac.digest('base64');

    if (digest !== signature) {
      console.warn('Invalid HMAC signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('Webhook received:', req.body);

  // Build Tapfiliate conversion data
  const conversionData = {
    program_id: process.env.TAPFILIATE_PROGRAM_ID,
    amount: req.body.data.amounts.total.amount, // Total order amount
    external_id: req.body.data.id,              // Fourthwall order ID
    customer_email: req.body.data.email         // Supporter email
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
