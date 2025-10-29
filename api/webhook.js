import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const TAPFILIATE_API_KEY = process.env.TAPFILIATE_API_KEY;

// --- Fourthwall Webhook Endpoint ---
app.post("/fourthwall-webhook", async (req, res) => {
  try {
    const body = req.body;

    console.log("🔔 Webhook received:", JSON.stringify(body, null, 2));

    const eventType = body?.type;
    const order = body?.data?.order;

    // Ignore if no order data
    if (!order) {
      console.error("❌ No order data found.");
      return res.status(400).send("No order data");
    }

    // Extract the amount safely
    const amount = order?.amounts?.total?.value || 0;
    const currency = order?.amounts?.total?.currency || "USD";
    const externalId = order?.id;
    const affiliateRef =
      order?.trackingParams?.ref ||
      order?.trackingParams?.affiliate ||
      order?.trackingParams?.affiliate_id ||
      null;

    console.log("💰 Order Amount:", amount, currency);
    console.log("🧠 Affiliate Ref:", affiliateRef);

    // Only fire when an order is completed or delivered
    if (eventType === "ORDER_UPDATED" && order.status === "DELIVERED") {
      console.log("🚀 Sending conversion to Tapfiliate...");

      const response = await fetch("https://api.tapfiliate.com/1.6/conversions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": TAPFILIATE_API_KEY,
        },
        body: JSON.stringify({
          external_id: externalId,
          amount,
          currency,
          referral_code: affiliateRef,
        }),
      });

      const result = await response.json();
      console.log("✅ Tapfiliate response:", result);
    } else {
      console.log("ℹ️ Order not completed yet, skipping conversion.");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 Webhook error:", err);
    res.sendStatus(500);
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Webhook server running on port ${PORT}`);
});
