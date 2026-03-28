import Link from 'next/link';
import { NewsletterForm } from './NewsletterForm';

function SiteFooter() {
  return (
    <footer className="border-t border-semantic-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-semantic-text-secondary mb-2">Stay in the loop</p>
              <NewsletterForm />
            </div>
            <nav className="flex flex-wrap gap-6 text-sm text-semantic-text-muted">
              <Link href="/terms" className="sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom">
                Terms of Service
              </Link>
              <Link href="/privacy" className="sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom">
                Privacy Policy
              </Link>
              <Link href="/help" className="sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom">
                Help
              </Link>
              <Link href="/contact" className="sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom">
                Contact
              </Link>
            </nav>
          </div>
          <p className="text-sm text-semantic-text-muted">&copy; 2026 Second Turn Games</p>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
