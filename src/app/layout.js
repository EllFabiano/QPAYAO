import './globals.css';
import { QPayProvider } from '@/context/QPayContext';

export const metadata = {
  title: 'QPAY AO — Pagamentos Digitais por QR Code | Uíge, Angola',
  description:
    'QPAY AO – Sistema de pagamentos digitais por QR Code sem necessidade de conta bancária, para comerciantes e vendedores informais da província do Uíge, Angola.',
  manifest: '/manifest.json',
  icons: {
    icon: '/Img/Qpaylogo.png',
    apple: '/assets/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#080C18',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-AO">
      <body>
        <QPayProvider>{children}</QPayProvider>
      </body>
    </html>
  );
}

