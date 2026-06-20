import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lightfern Champion Radar",
  description:
    "Review, prioritise, and activate potential product champions identified through Unify.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
