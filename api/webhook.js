import fetch from "node-fetch";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse webhook body
    const body = req.body;
    console.log("📦 Webhook received:", JSON.stringify(body, null, 2));

    // Extract important data
    const order = body.data?.order || body.data;
    if (!order) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Extract amount
    const totalAmount = order.amounts?.total?.amount || 0;
    const currency = order.amounts?.total?.currency || "USD";
    const email = order.email || "unknown@customer.com";

    // Build Tapfiliate conversion payload
    const conversionPayload = {
      amount: totalAmount,
      external_id: order.id || body.id,
      affiliate_id: order.trackingParams?.ref || null, // optional
      customer_id: email,
      currency: currency,
      meta_data: {
        checkoutId: order.checkoutId,
        friendlyId: order.friendlyId,
        email: email,
      },
    };

    console.log("💰 Sending to Tapfiliate:", conversionPayload);

    // Send to Tapfiliate
    const tapResponse = await fetch("https://api.tapfiliate.com/1.6/conversions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.TAPFILIATE_API_KEY,
      },
      body: JSON.stringify(conversionPayload),
    });

    const tapData = await tapResponse.json();
    console.log("✅ Tapfiliate response:", tapData);

    return res.status(200).json({ success: true, tapData });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
