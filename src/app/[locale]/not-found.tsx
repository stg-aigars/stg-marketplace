import { DiceThree } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <EmptyState
        icon={DiceThree}
        title="This game has left the table"
        description="The page you are looking for does not exist — maybe the listing was sold or removed."
        action={{ label: 'Browse games', href: '/browse' }}
      />
    </div>
  );
}
