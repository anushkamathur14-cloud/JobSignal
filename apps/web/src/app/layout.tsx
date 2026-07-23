import type { Metadata } from "next";
import { Source_Sans_3, Fraunces } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  weight: ["400", "600", "700"],
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Job Signal",
  description: "Personal hiring trends across Greenhouse, Lever, Ashby, Workday & more",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable}`} style={{ fontFamily: "var(--font-body-loaded), var(--font-body)" }}>
        <div className="min-h-screen">
          <Nav />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
