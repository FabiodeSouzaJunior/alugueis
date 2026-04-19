import "./globals.css";
import { ThemeProvider } from "@/context/theme";

// Script inline que roda ANTES do React — evita flash branco/escuro
const themeScript = `(function(){try{var t=localStorage.getItem("theme")||"dark";var r=t;if(t==="system"){r=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(r);document.documentElement.setAttribute("data-theme",r)}catch(e){document.documentElement.classList.add("dark")}})()`;

export const metadata = {
  title: "Kitnets - Gestão de Imóveis",
  description: "Sistema de gestão de kitnets, pagamentos e manutenção",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased bg-background text-foreground">
        <ThemeProvider defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
