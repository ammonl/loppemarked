import { LanguageProvider } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UN17 Village Loppemarked",
  description: "Forårets loppemarked i Fælledhuset, UN17 Village — book dit loppebord.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&family=Caveat:wght@400;600;700&family=Montserrat:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body style={{ margin: 0, background: colors.fleaCream }}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
