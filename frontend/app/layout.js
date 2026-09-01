import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "Inventory Copilot",
  description: "AI-powered demand forecasting & inventory optimization",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
