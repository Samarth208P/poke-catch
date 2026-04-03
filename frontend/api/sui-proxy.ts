const SUI_RPC_URLS = [
  "https://sui-testnet-rpc.publicnode.com",
  "https://sui-testnet.nodeinfra.com",
  "https://fullnode.testnet.sui.io:443",
];

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

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  for (const rpcUrl of SUI_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await response.text();

      if (response.status >= 500) {
        console.warn(`RPC ${rpcUrl} returned ${response.status}, trying next...`);
        continue;
      }

      res.setHeader("Content-Type", "application/json");
      return res.status(response.status).end(data);
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error);
      continue;
    }
  }

  return res.status(502).json({ error: "All Sui RPC endpoints are unavailable" });
}
