import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata = {
  title: 'GIÁO ÁN I.O – Soạn Giáo Án Thông Minh với AI',
  description:
    'Ứng dụng soạn giáo án thông minh tích hợp AI: Google Gemini, OpenAI GPT-4o, và Anthropic Claude. Tự động phân rã hoạt động theo chuẩn sư phạm.',
  keywords: 'giáo án, AI, soạn giáo án, Gemini, GPT-4, giáo dục, BYOK',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body
        className={`${inter.className} antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900`}
      >
        {/* Subtle ambient gradient layer */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.08)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.06)_0%,_transparent_60%)]" />
        {children}
        <footer className="text-center py-6 text-sm text-slate-400 font-medium">
          Sản phẩm được phát triển bởi{' '}
          <span className="text-indigo-500 font-semibold">Điền tên của bạn vào đây</span>
        </footer>
      </body>
    </html>
  );
}
