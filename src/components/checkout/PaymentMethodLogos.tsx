import Image from 'next/image';

const METHODS = [
  { name: 'Visa', src: '/images/payments/visa.svg' },
  { name: 'Mastercard', src: '/images/payments/mastercard.svg' },
] as const;

export function PaymentMethodLogos() {
  return (
    <div className="flex items-center justify-center gap-3">
      {METHODS.map((method) => (
        <Image
          key={method.name}
          src={method.src}
          alt={method.name}
          width={40}
          height={26}
          className="opacity-50"
        />
      ))}
    </div>
  );
}
