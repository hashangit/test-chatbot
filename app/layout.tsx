// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Import global styles (including Tailwind)

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inference Quotient Support Bot",
  description: "Customer support chatbot for Inference Quotient",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}