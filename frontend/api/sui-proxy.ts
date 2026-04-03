import type { IncomingMessage, ServerResponse } from "http";

const SUI_RPC_URL = "https://fullnode.testnet.sui.io";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Only allow POST requests (JSON-RPC uses POST)
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    // Read request body
    const body = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const response = await fetch(SUI_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    const data = await response.text();

    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(data);
  } catch (error) {
    console.error("Sui proxy error:", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to proxy request to Sui fullnode" }));
  }
}
