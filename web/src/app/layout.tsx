import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 侦探社 · 元宝搜索",
  description:
    "丢给它一个问题，它去全网查清楚，带着证据回来。基于腾讯云元宝搜索 SearchPro 的深度调查与持续盯梢。",
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col antialiased">{children}</body>
    </html>
  );
}
