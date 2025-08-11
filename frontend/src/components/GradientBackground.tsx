import type { PropsWithChildren } from 'react'

export default function GradientBackground({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen w-full relative bg-black">
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(226, 232, 240, 0.15), transparent 70%), #000000',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}


