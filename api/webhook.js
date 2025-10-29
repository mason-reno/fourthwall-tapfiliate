import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("Webhook received:", req.body);

    const { data, type } = req.body;

    if (type !== "ORDER_PLACED") {
      return res.status(200).json({ message: "Ignored non-order webhook" });
    }

    const amount = data?.amounts?.total?.amount || 0;
    const currency = data?.amounts?.total?.currency || "USD";
    const externalId = data?.friendlyId || data?.id || "no-id";
    const email = data?.email || "no-email@example.com";
    const visitorId =
      data?.trackingParams?.utm_source ||
      data?.trackingParams?.utm_term ||
      data?.trackingParams?.utm_medium ||
      "unknown_visitor";

    console.log("Parsed order:", { amount, currency, externalId, email, visitorId });

    // 🔥 Send conversion to Tapfiliate
    const tapfiliateResponse = await fetch("https://api.tapfiliate.com/1.6/conversions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.TAPFILIATE_KEY,
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        amount,
        external_id: externalId,
        customer_email: email,
        currency,
        program_id: process.env.TAPFILIATE_PROGRAM_ID,
      }),
    });

    const tapResponse = await tapfiliateResponse.json();
    console.log("Tapfiliate response:", tapResponse);

    res.status(200).json({ success: true, tapResponse });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}
