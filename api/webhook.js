import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Check env variables
  const HMAC_SECRET = process.env.FOURTHWALL_HMAC_SECRET;
  const TAPFILIATE_KEY = process.env.TAPFILIATE_KEY;
  const TAPFILIATE_PROGRAM_ID = process.env.TAPFILIATE_PROGRAM_ID;

  if (!HMAC_SECRET || !TAPFILIATE_KEY || !TAPFILIATE_PROGRAM_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-fourthwall-signature'];

  // Verify HMAC signature
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(payload);
  const digest = hmac.digest('base64');

  if (digest !== signature) {
    console.warn('Invalid HMAC signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Webhook verified:', req.body);

  // Build Tapfiliate conversion data
  const conversionData = {
    program_id: TAPFILIATE_PROGRAM_ID,
    amount: req.body.total_amount || 0, // pull from Fourthwall payload
    external_id: req.body.id || 'unknown_order', // order ID fallback
    customer_email: req.body.email || 'unknown@example.com' // fallback email
  };

  try {
    const tapResponse = await fetch('https://api.tapfiliate.com/1.6/conversions/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': TAPFILIATE_KEY
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
