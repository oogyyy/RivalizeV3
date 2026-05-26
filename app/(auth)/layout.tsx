export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(175deg, #09091a 0%, #0d0b24 45%, #090915 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(155,29,255,0.12), transparent)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(255,45,120,0.06), transparent)',
      }}/>

      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255,45,120,0.45)',
            }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h8L9 9h7L7 18l2-6H5L4 3z" fill="white"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-sora, Sora), sans-serif',
              fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '0.08em',
            }}>
              RIVALIZE
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-inter, Inter), sans-serif',
            fontSize: 13, color: 'rgba(255,255,255,0.4)',
          }}>
            AI-Powered CS2 Analysis
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
