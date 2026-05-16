export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{
        backgroundImage: `radial-gradient(ellipse at top, rgba(0,255,135,0.05) 0%, transparent 60%)`,
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#00ff87] rounded-md flex items-center justify-center">
              <span className="text-black font-black text-sm">R</span>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">RIVALIZE</span>
          </div>
          <p className="text-muted-foreground text-sm">AI-Powered CS2 Analysis</p>
        </div>
        {children}
      </div>
    </div>
  )
}
