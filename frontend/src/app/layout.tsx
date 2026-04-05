import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { SensorProvider } from "@/context/SensorContext";
import Navbar from "@/components/Navbar";
import LoadingOverlay from "@/components/LoadingOverlay";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ Thống Học Máy",
  description: "IoT Greenhouse Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="darkMode"
        >
          <SensorProvider>
            <div className="app-container">
              <Navbar />
              <main className="main-content">
                {children}
              </main>
              <LoadingOverlay />
            </div>
          </SensorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
