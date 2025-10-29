import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("📦 Webhook received:", JSON.stringify(body, null, 2));

    // Determine order data
    const order = body.data?.order || body.data;
    if (!order) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Extract amounts
    const totalAmount = order.amounts?.total?.amount || 0;
    const currency = order.amounts?.total?.currency || "USD";
    const email = order.email || "unknown@customer.com";

    // Mandatory Tapfiliate fields
    const conversionPayload = {
      program_id: process.env.TAPFILIATE_PROGRAM_ID, // Make sure this is set
      amount: totalAmount,
      currency: currency,
      external_id: order.id || body.id,
      customer_email: email,
    };

    console.log("💰 Sending to Tapfiliate:", conversionPayload);

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
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
