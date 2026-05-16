import { House } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/ui';
import './globals.css';

export const metadata = {
  title: 'Page not found | Second Turn Games',
};

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-white antialiased">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <EmptyState
            icon={House}
            title="Page not found"
            description="The page you are looking for does not exist."
            action={{ label: 'Back to home', href: '/' }}
          />
        </div>
      </body>
    </html>
  );
}
