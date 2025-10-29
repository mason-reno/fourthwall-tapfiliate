import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log("Webhook received:", req.body);

    const event = req.body;
    const order = event.data;

    if (!order) {
      return res.status(400).json({ error: "No order data in webhook" });
    }

    // ✅ Extract required values
    const email = order.email || "unknown@example.com";
    const externalId = order.id || "no-id";
    const amount = parseFloat(order.amounts?.total?.amount || 0);
    const currency = order.amounts?.total?.currency || "USD";

    // ✅ Capture visitor_id (from UTM or cookie)
    const visitor_id =
      order.trackingParams?.tapfiliate_click_id ||
      order.trackingParams?.visitor_id ||
      order.trackingParams?.utm_term || // fallback
      null;

    if (!visitor_id) {
      console.warn("⚠️ Missing visitor_id in order:", order);
    }

    console.log("Sending to Tapfiliate:", {
      visitor_id,
      externalId,
      email,
      amount,
      currency,
      program_id: process.env.TAPFILIATE_PROGRAM_ID,
    });

    // ✅ Send conversion to Tapfiliate
    const tapfiliateResponse = await fetch(
      "https://api.tapfiliate.com/1.6/conversions/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": process.env.TAPFILIATE_KEY,
        },
        body: JSON.stringify({
          visitor_id,
          external_id: externalId,
          customer_email: email,
          amount,
          currency,
          program_id: process.env.TAPFILIATE_PROGRAM_ID,
        }),
      }
    );

    const data = await tapfiliateResponse.json();
    console.log("Tapfiliate response:", data);

    res.status(200).json({ status: "success", tapfiliate: data });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: error.message });
  }
}
