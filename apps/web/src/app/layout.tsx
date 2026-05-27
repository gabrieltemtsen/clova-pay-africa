import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Web3Providers } from "@/components/Web3Providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const frame = {
  version: "1",
  imageUrl: "https://clova-pay-africa.vercel.app/opengraph-image.png",
  button: {
    title: "🚩 Start",
    action: {
      type: "launch_frame",
      name: "Clova Pay Africa",
      url: "https://clova-pay-africa.vercel.app/app",
      splashImageUrl: "https://clova-pay-africa.vercel.app/logo.png",
      splashBackgroundColor: "#000000"
    }
  }
};

export const metadata: Metadata = {
  title: "Clova Pay Africa | Decentralized API Routing Protocol",
  description: "A decentralized routing protocol for instant, secure, zero-fee global payments for businesses across Africa.",
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
  openGraph: {
    title: "Clova Pay Africa",
    description: "Instant, secure, zero-fee global payments for businesses across Africa.",
    url: "https://clovapay.africa",
    siteName: "Clova Pay",
    images: [{ url: "/logo.svg" }],
  },
  other: {
    "talentapp:project_verification": "3f219c0bf944ee2abcb6e7f23e1edecec3db0b111a2ece22213d8b40abd5976ddc7f51ef836e3cd58561b9307b44790d978c088637fd57c2b0a5df76986b982b",
    "fc:miniapp": JSON.stringify(frame),
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-black text-white selection:bg-brand selection:text-white`}>
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
