export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,255,135,0.07),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_80%,rgba(0,212,255,0.04),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_20%_60%,rgba(0,255,135,0.03),transparent)]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 bg-[#00ff87] rounded-lg flex items-center justify-center shadow-[0_0_16px_rgba(0,255,135,0.45)]">
              <span className="text-black font-black text-sm tracking-tight">R</span>
            </div>
            <span className="text-2xl font-black text-white tracking-[0.15em]">RIVALIZE</span>
          </div>
          <p className="text-muted-foreground/70 text-sm">AI-Powered CS2 Analysis</p>
        </div>
        {children}
      </div>
    </div>
  )
}
