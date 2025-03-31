"use client"

import { useState, useEffect } from "react"

interface TypingEffectProps {
  text: string
  className?: string
  speed?: number
  delay?: number
}

export default function TypingEffect({ text, className = "", speed = 50, delay = 500 }: TypingEffectProps) {
  const [displayText, setDisplayText] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!isTyping) return

    let currentIndex = 0
    
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayText(text.substring(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, isTyping])

  return (
    <span className={className}>
      {displayText}
      {displayText.length < text.length && <span className="animate-pulse">|</span>}
    </span>
  )
}

