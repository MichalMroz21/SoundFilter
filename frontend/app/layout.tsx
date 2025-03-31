import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Lato } from 'next/font/google'; 
import { cn } from "@/lib/utils";
import "./globals.css";
import Navbar from "@/components/navbar";
import { MantineProvider } from "@mantine/core";

export const metadata: Metadata = {
  title: "SoundFilter",
  description: "App for filtering sounds",
};

const lato = Lato({
  weight: ['400', '700'], 
  subsets: ['latin'], 
  display: 'swap', 
});

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body className={cn(
          "min-h-screen bg-background font-sans antialiased",
          lato.className
        )}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >           
            <Navbar className="h-[70px] sticky top-0"/>
            <MantineProvider>
              {children}
            </MantineProvider>     
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
