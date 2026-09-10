import "./globals.css";

export const metadata = {
  title: "WeatherGPT AI — Global Weather Intelligence",
  description: "AI-powered global weather, forecasts, alerts, travel and outdoor intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}