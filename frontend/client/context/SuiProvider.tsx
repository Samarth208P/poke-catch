import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

// In production (Vercel), use our proxy to avoid CORS issues.
// In development, the direct URL works fine.
const suiRpcUrl =
    import.meta.env.PROD
        ? "/api/sui-proxy"
        : "https://fullnode.testnet.sui.io";

const { networkConfig } = createNetworkConfig({
    testnet: {
        url: suiRpcUrl,
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