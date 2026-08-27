import { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function Card({ title, description, footer, children }: Props) {
  return (
    <div className="w-full max-w-3xl m-auto my-6 sm:my-8 border rounded-md border-thubpay-border bg-thubpay-surface/90 p-4 sm:p-5 shadow-lg">
      <div className="px-2 sm:px-5 py-4">
        <h3 className="mb-1 text-2xl font-medium text-white">{title}</h3>
        <p className="text-zinc-300">{description}</p>
        {children}
      </div>
      {footer && (
        <div className="p-4 border-t rounded-b-md border-thubpay-border bg-thubpay-obsidian text-zinc-400">
          {footer}
        </div>
      )}
    </div>
  );
}
