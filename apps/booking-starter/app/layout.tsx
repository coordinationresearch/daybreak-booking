import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@daybreak/booking/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Book a time", template: "%s" },
  description: "Book time with me.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
