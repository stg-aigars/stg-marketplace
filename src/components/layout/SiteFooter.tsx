import Link from 'next/link';

function SiteFooter() {
  return (
    <footer className="bg-semantic-bg-secondary border-t border-semantic-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <div>
            <nav className="flex flex-wrap gap-6 text-sm text-semantic-text-muted">
              <Link href="/terms" className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                Terms of Service
              </Link>
              <Link href="/privacy" className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                Privacy Policy
              </Link>
              <Link href="/seller-terms" className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                Seller Terms
              </Link>
              <Link href="/help" className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                Help
              </Link>
              <Link href="/contact" className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                Contact
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-sm font-display tracking-tight font-semibold text-semantic-text-secondary">
              Second Turn Games
            </p>
            <p className="text-sm italic text-semantic-text-muted mt-0.5">
              Every game deserves a second turn
            </p>
            <p className="text-xs text-semantic-text-muted mt-2">&copy; {new Date().getFullYear()} Second Turn Games</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
