"use client"

import type { ReactNode } from "react"

interface FloatingElementProps {
  children: ReactNode
  className?: string
  amplitude?: number
  duration?: number
}

export default function FloatingElement({
  children,
  className = "",
  amplitude = 10,
  duration = 4,
}: FloatingElementProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        animation: `floating ${duration}s ease-in-out infinite`,
      }}
    >

      <style jsx>{`
        @keyframes floating {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-${amplitude}px);
          }
        }
      `}</style>

      {children}
      
    </div>
  )
}

