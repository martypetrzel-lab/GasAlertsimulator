import type { Metadata, Viewport } from "next";
import "./globals.css";
import Pwa from "@/components/Pwa";
export const metadata: Metadata = {
  title: "GasAlert | Výcvikový simulátor",
  description: "Společný výcvik, věrná simulace. Neměří skutečné plyny.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GasAlert výcvik",
  },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1217",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <Pwa />
        {children}
      </body>
    </html>
  );
}
