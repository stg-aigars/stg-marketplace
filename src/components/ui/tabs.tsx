'use client';

interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 border-b border-semantic-border-subtle ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              isActive
                ? 'text-semantic-brand'
                : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'
            }`}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-semantic-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
export type { TabsProps, TabItem };
