import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/health", destination: "/api/clova/health" },
      { source: "/v1/quotes", destination: "/api/clova/quotes" },
      { source: "/v1/orders", destination: "/api/clova/orders" },
      { source: "/v1/orders/:orderId", destination: "/api/clova/orders/:orderId" },
      { source: "/v1/onramp/quote", destination: "/api/clova/onramp/quote" },
      { source: "/v1/onramp/orders", destination: "/api/clova/onramp/order" },
      { source: "/v1/onramp/orders/:orderId", destination: "/api/clova/onramp/order/:orderId" },
      { source: "/v1/banks", destination: "/api/clova/banks" },
      { source: "/v1/settlements/credited", destination: "/api/clova/settlements/credited" },
      { source: "/v1/address/:address/orders", destination: "/api/clova/my-orders?address=:address" },
      { source: "/v1/stats", destination: "/api/clova/stats" },
      { source: "/v1/recipients/resolve", destination: "/api/clova/verify-account" },
      { source: "/v1/verify-account", destination: "/api/clova/verify-account" },
      { source: "/v1/webhooks/paycrest", destination: "/api/clova/webhooks/paycrest" },
    ];
  },
};

export default nextConfig;
