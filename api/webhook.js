import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("📦 Webhook received:", JSON.stringify(body, null, 2));

    // Fourthwall sends order data in body.data
    const order = body.data;
    if (!order) {
      console.error("❌ No order data found in payload");
      return res.status(400).json({ error: "Invalid payload - no order data" });
    }

    // Extract amount - Fourthwall uses .value not .amount
    let totalAmount = 0;
    
    if (order.amounts?.total?.value) {
      totalAmount = parseFloat(order.amounts.total.value);
    } else if (order.amounts?.total?.amount) {
      totalAmount = parseFloat(order.amounts.total.amount);
    } else if (order.total_price) {
      totalAmount = parseFloat(order.total_price);
    } else if (order.total) {
      totalAmount = parseFloat(order.total);
    }

    console.log("💵 Extracted amount:", totalAmount);

    // Get currency
    const currency = order.amounts?.total?.currency || "USD";

    // Get email
    const email = order.email || "unknown@customer.com";

    // Get order ID - use Fourthwall's order ID
    const orderId = order.id || body.id;

    // Validate we have an amount
    if (!totalAmount || totalAmount === 0) {
      console.error("❌ Amount is zero or invalid");
      console.error("Order amounts:", JSON.stringify(order.amounts, null, 2));
      return res.status(400).json({ 
        error: "Could not extract valid amount from order",
        debug: {
          amounts: order.amounts,
          extracted_amount: totalAmount
        }
      });
    }

    // Tapfiliate conversion payload
    const conversionPayload = {
      program_id: process.env.TAPFILIATE_PROGRAM_ID,
      amount: totalAmount.toString(),
      currency: currency,
      external_id: orderId,
      customer_email: email,
    };

    console.log("💰 Sending to Tapfiliate:", conversionPayload);

    // Validate environment variables
    if (!process.env.TAPFILIATE_API_KEY || !process.env.TAPFILIATE_PROGRAM_ID) {
      console.error("❌ Missing Tapfiliate credentials");
      return res.status(500).json({ 
        error: "Missing TAPFILIATE_API_KEY or TAPFILIATE_PROGRAM_ID" 
      });
    }

    const tapResponse = await fetch("https://api.tapfiliate.com/1.6/conversions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.TAPFILIATE_API_KEY,
      },
      body: JSON.stringify(conversionPayload),
    });

    const tapData = await tapResponse.json();
    
    if (!tapResponse.ok) {
      console.error("❌ Tapfiliate error:", tapData);
      return res.status(tapResponse.status).json({ 
        error: "Tapfiliate API error", 
        details: tapData 
      });
    }

    console.log("✅ Tapfiliate response:", tapData);
    console.log("✅ SUCCESS! Tracked $" + totalAmount + " " + currency);

    return res.status(200).json({ 
      success: true, 
      tapData,
      debug: {
        extracted_amount: totalAmount,
        currency: currency,
        order_id: orderId,
        email: email
      }
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}