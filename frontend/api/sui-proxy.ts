import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUI_RPC_URL = "https://fullnode.testnet.sui.io";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (JSON-RPC uses POST)
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(SUI_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Sui proxy error:", error);
    return res.status(502).json({ error: "Failed to proxy request to Sui fullnode" });
  }
}
