import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pro Scout | Rivalize',
  description: 'Rivalize Pro-Scout modular tactical workspace',
};

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
