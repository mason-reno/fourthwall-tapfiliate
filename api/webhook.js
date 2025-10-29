const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = req.body;
  console.log('Webhook received:', body);

  const totalAmount = body.total_amount || body.amount || 0;
  const orderId = body.id || 'unknown_order';
  const customerEmail = body.email || 'unknown_email@example.com';

  const conversionData = {
    program_id: '62039',
    amount: totalAmount,
    external_id: orderId,
    customer_email: customerEmail
  };

  try {
    const response = await fetch('https://api.tapfiliate.com/1.6/conversions/', {
      method: 'POST',
      headers: {
        'Api-Key': '4b1b9833fe6f5acb0a9cdd813822010294a9fd42',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(conversionData)
    });

    const result = await response.json();
    console.log('Tapfiliate response:', result);

    res.status(200).json({ message: 'Webhook processed', tapfiliate: result });
  } catch (error) {
    console.error('Error sending to Tapfiliate:', error);
    res.status(500).json({ error: 'Error sending to Tapfiliate' });
  }
};
