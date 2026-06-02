import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pro Scout',
  description: 'Rivalize Pro-Scout tactical modular subviews',
};

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden bg-brand-bg">
      {/* Subview tab rail */}
      <ScoutNav />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function ScoutNav() {
  const links = [
    { href: '/scout',           label: 'Dashboard',  short: 'DB' },
    { href: '/scout/my-team',   label: 'My Team',    short: 'MT' },
    { href: '/scout/opponents', label: 'Opponents',  short: 'OP' },
    { href: '/scout/prep',      label: 'Match Prep', short: 'MP' },
    { href: '/scout/playbook',  label: 'Playbook',   short: 'PB' },
    { href: '/scout/lineups',   label: 'Lineups',    short: 'LU' },
    { href: '/scout/veto',      label: 'Veto Sim',   short: 'VS' },
    { href: '/scout/ai',        label: 'AI Scout',   short: 'AI' },
  ];

  return (
    <nav className="w-16 bg-[#090b13] border-r border-brand-border/60 flex flex-col items-center py-4 gap-1 shrink-0">
      {links.map(l => (
        <a
          key={l.href}
          href={l.href}
          title={l.label}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-[10px] font-mono font-bold text-gray-500 hover:text-white hover:bg-brand-purple/20 transition"
        >
          {l.short}
        </a>
      ))}
    </nav>
  );
}
