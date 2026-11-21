import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@coordination/booking/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Book a time", template: "%s" },
  description: "Book time with me.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  // The booking page's own ground; it sets these again while it's shown.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
