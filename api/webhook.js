import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Use raw body from request (Vercel passes parsed JSON by default)
  const payload = JSON.stringify(req.body); // ok for Vercel default

  const signature = req.headers['x-fourthwall-signature'];
  const secret = process.env.FOURTHWALL_HMAC_SECRET;

  if (!secret) {
    console.error('HMAC secret not set!');
    return res.status(500).json({ error: 'HMAC secret missing' });
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  if (digest !== signature) {
    console.warn('Invalid HMAC signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Webhook verified:', req.body);

  const conversionData = {
    program_id: process.env.TAPFILIATE_PROGRAM_ID,
    amount: req.body.data.amounts.total.amount,
    external_id: req.body.id,
    customer_email: req.body.data.email
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
