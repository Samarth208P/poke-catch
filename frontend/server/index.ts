import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";

const SUI_RPC_URLS = [
  "https://sui-testnet-rpc.publicnode.com",
  "https://sui-testnet.nodeinfra.com",
  "https://fullnode.testnet.sui.io:443",
];

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Sui RPC proxy — avoids CORS by forwarding requests server-side
  app.post("/api/sui-proxy", async (req, res) => {
    const body = JSON.stringify(req.body);

    for (const rpcUrl of SUI_RPC_URLS) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        const data = await response.text();

        // If the upstream returned a server error, try the next URL
        if (response.status >= 500) {
          console.warn(`RPC ${rpcUrl} returned ${response.status}, trying next...`);
          continue;
        }

        res.setHeader("Content-Type", "application/json");
        return res.status(response.status).send(data);
      } catch (error) {
        console.warn(`RPC ${rpcUrl} failed:`, error);
        continue;
      }
    }

    res.status(502).json({ error: "All Sui RPC endpoints are unavailable" });
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}

