import { formatPrice } from '@/lib/services/pricing';

export interface LineItem {
  description: string;
  grossEuros: number;
  netEuros: number;
  vatRate: number;
  vatEuros: number;
}

interface DocumentLineItemsProps {
  items: LineItem[];
}

export function DocumentLineItems({ items }: DocumentLineItemsProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-semantic-border-subtle text-left text-xs font-medium uppercase tracking-wide text-semantic-text-secondary">
            <th className="pb-2 pr-4">Description</th>
            <th className="pb-2 pr-4 text-right">Gross</th>
            <th className="pb-2 pr-4 text-right">Net</th>
            <th className="pb-2 pr-4 text-right">VAT Rate</th>
            <th className="pb-2 text-right">VAT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-semantic-border-subtle">
              <td className="py-3 pr-4 text-semantic-text-primary">{item.description}</td>
              <td className="py-3 pr-4 text-right text-semantic-text-primary">{formatPrice(item.grossEuros)}</td>
              <td className="py-3 pr-4 text-right text-semantic-text-secondary">{formatPrice(item.netEuros)}</td>
              <td className="py-3 pr-4 text-right text-semantic-text-secondary">{(item.vatRate * 100).toFixed(0)}%</td>
              <td className="py-3 text-right text-semantic-text-secondary">{formatPrice(item.vatEuros)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
