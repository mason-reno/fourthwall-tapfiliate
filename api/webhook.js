import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("📦 Webhook received:", JSON.stringify(body, null, 2));

    // Fourthwall sends order data in body.data
    const order = body.data?.order || body.data;
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

    // Get order ID - use Fourthwall's order ID as external_id
    const orderId = order.id || body.id;

    // Validate we have an amount
    if (!totalAmount || totalAmount === 0) {
      console.error("❌ Amount is zero or invalid");
      return res.status(400).json({ 
        error: "Could not extract valid amount from order"
      });
    }

    // Extract referral code from tracking params
    const trackingParams = order.trackingParams || {};
    
    // Check multiple possible locations for the referral code
    const referralCode = trackingParams.ref || 
                        trackingParams.referral_code ||
                        order.ref ||
                        order.referral_code;

    console.log("🔍 Checking for referral code...");
    console.log("   trackingParams:", JSON.stringify(trackingParams));
    console.log("   Found referral code:", referralCode || "NONE");

    // Tapfiliate Postback API v1.7 payload
    const conversionPayload = {
      external_id: orderId,
      amount: totalAmount.toString(),
      currency: currency
    };

    // Add referral_code if available
    if (referralCode) {
      conversionPayload.referral_code = referralCode;
      console.log("✅ Using referral_code:", referralCode);
    } else {
      console.log("⚠️  WARNING: No referral code found!");
      console.log("   This conversion will NOT be attributed to an affiliate.");
      
      // Skip Tapfiliate for non-affiliate orders
      return res.status(200).json({ 
        success: false,
        message: "Order received but no referral code found - not sent to Tapfiliate",
        debug: {
          amount: totalAmount,
          currency: currency,
          order_id: orderId,
          trackingParams: trackingParams
        }
      });
    }

    console.log("💰 Sending to Tapfiliate Postback API:", conversionPayload);

    // Validate API key
    if (!process.env.TAPFILIATE_API_KEY) {
      console.error("❌ Missing Tapfiliate API key");
      return res.status(500).json({ 
        error: "Missing TAPFILIATE_API_KEY" 
      });
    }

    // Send to Tapfiliate Postback API v1.7
    const tapResponse = await fetch("https://api.tapfiliate.com/1.7/pb/con/c/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.TAPFILIATE_API_KEY,
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
        email: email,
        referral_code: referralCode
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