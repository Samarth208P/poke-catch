import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

// Always use the proxy path to avoid CORS issues.
// Dev: Vite proxy forwards to fullnode.testnet.sui.io
// Prod: Vercel serverless function forwards to fullnode.testnet.sui.io
const { networkConfig } = createNetworkConfig({
    testnet: {
        url: "/api/sui-proxy",
    },
});

export function SuiProvider({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
                <WalletProvider autoConnect>
                    {children}
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}