import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexora — Paper Trading",
  description: "Practice crypto trading with live markets, virtual capital, and a persistent paper portfolio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="dark" richColors position="top-right" toastOptions={{ className: "toast" }} />
      </body>
    </html>
  );
}
