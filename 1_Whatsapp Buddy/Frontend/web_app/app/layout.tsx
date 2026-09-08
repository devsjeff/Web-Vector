import "./globals.css";

export const metadata = {
  title: "WEB VECTOR — WhatsApp AI Assistant",
  description:
    "An AI assistant for WhatsApp that understands context, remembers useful information, accesses tools, and performs useful actions.",
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