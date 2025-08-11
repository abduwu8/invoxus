    "use client";
import { useRef } from "react";

export function PointerHighlight({
  children,
  rectangleClassName,
  containerClassName,
}: { children: React.ReactNode; rectangleClassName?: string; containerClassName?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={containerRef} className={`relative inline-block w-fit ${containerClassName || ''}`}>
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-md border ${
          rectangleClassName || 'border-neutral-700'
        }`}
      />
    </div>
  )
}
