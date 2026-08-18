import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/ds.css";
import { I18nProvider } from "@/lib/i18n";

const ibmSans = IBM_Plex_Sans({ variable: "--font-ibm-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const ibmMono = IBM_Plex_Mono({ variable: "--font-ibm-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata = {
  title: "Fruitbrix Field — Control de calidad",
  description: "Captura y gestión de inspecciones de calidad frutícola",
  openGraph: {
    title: "Fruitbrix Field",
    description: "Captura y gestión de inspecciones de calidad frutícola",
    siteName: "Fruitbrix",
    type: "website",
  },
};

// Sin esto, los navegadores móviles renderizan a ~980px y escalan (todo se ve en miniatura)
export const viewport = { width: "device-width", initialScale: 1 };

const themeInit = `try{document.documentElement.dataset.theme=localStorage.getItem('insp-theme')||'light'}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="light" className={`${ibmSans.variable} ${ibmMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
