const SUI_RPC_URL = "https://fullnode.testnet.sui.io";

// Vercel serverless functions extend the standard request with a pre-parsed `body`.
export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only allow POST (JSON-RPC uses POST)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Vercel auto-parses the body — stringify it back for the upstream request
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    const response = await fetch(SUI_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await response.text();

    res.setHeader("Content-Type", "application/json");
    return res.status(response.status).end(data);
  } catch (error) {
    console.error("Sui proxy error:", error);
    return res.status(502).json({ error: "Failed to proxy request to Sui fullnode" });
  }
}
