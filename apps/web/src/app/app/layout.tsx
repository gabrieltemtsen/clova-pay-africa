import type { Metadata } from "next";

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
  title: "Clova Pay | App",
  description: "Instant stablecoin cashouts to African bank accounts.",
  other: {
    "fc:miniapp": JSON.stringify(frame),
  },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
