import Link from 'next/link';
import { DiceThree } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl border-[1.5px] border-dashed border-semantic-border-default mb-6">
          <DiceThree size={36} className="text-semantic-brand" weight="regular" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
          This game has left the table
        </h1>
        <p className="text-semantic-text-secondary max-w-md mx-auto">
          The page you are looking for does not exist — maybe the listing was sold or removed.
        </p>
        <Link href="/browse" className="inline-block mt-6">
          <Button>Browse games</Button>
        </Link>
      </div>
    </div>
  );
}
