"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base, celo } from "viem/chains";

const queryClient = new QueryClient();

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

const config = createConfig({
  chains: [base, celo],
  transports: {
    [base.id]: http(),
    [celo.id]: http(),
  },
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "Clova Pay",
              description: "Multi-chain stablecoin cashout",
              url: "https://clova.cash",
              icons: ["https://clova.cash/icon.png"],
            },
          }),
        ]
      : []),
    coinbaseWallet({ appName: "Clova Pay" }),
  ],
  ssr: true,
});

export function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
