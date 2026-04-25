import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chip Table",
  description: "Self-hosted poker chip tracker"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
