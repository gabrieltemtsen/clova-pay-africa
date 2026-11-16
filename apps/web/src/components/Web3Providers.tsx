"use client";

import { WagmiProvider, createConfig, http, fallback } from "wagmi";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base, celo, arbitrum, polygon, mainnet, bsc } from "viem/chains";

const queryClient = new QueryClient();

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

const config = createConfig({
  chains: [base, celo, arbitrum, polygon, mainnet, bsc],
  transports: {
    [base.id]: fallback([http("https://mainnet.base.org"), http("https://base-rpc.publicnode.com"), http()]),
    [celo.id]: fallback([http("https://forno.celo.org"), http()]),
    [arbitrum.id]: fallback([http("https://arb1.arbitrum.io/rpc"), http("https://arbitrum-one-rpc.publicnode.com"), http()]),
    [polygon.id]: fallback([http("https://polygon-bor-rpc.publicnode.com"), http("https://polygon-rpc.com"), http()]),
    [mainnet.id]: fallback([http("https://ethereum-rpc.publicnode.com"), http("https://cloudflare-eth.com"), http()]),
    [bsc.id]: fallback([http("https://bsc-rpc.publicnode.com"), http("https://bsc-dataseed.binance.org"), http()]),
  },
  connectors: [
    farcasterMiniApp(),
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


