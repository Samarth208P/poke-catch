import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
    testnet: {
        url: "https://fullnode.testnet.sui.io",
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