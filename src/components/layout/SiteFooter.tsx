import Link from 'next/link';

function SiteFooter() {
  return (
    <footer className="border-t border-semantic-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-semantic-text-muted">
          <p>&copy; 2026 Second Turn Games</p>
          <nav className="flex gap-6">
            <Link href="#" className="sm:hover:text-semantic-text-secondary transition-colors">
              Terms of Service
            </Link>
            <Link href="#" className="sm:hover:text-semantic-text-secondary transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="sm:hover:text-semantic-text-secondary transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
