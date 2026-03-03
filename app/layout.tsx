import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComicGen MVP",
  description: "Multi-panel comic creator with OpenRouter image generation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
