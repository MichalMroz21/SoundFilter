import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number | string, precision: number = 2): string {
  // Convert string to number if needed
  if (typeof seconds === "string") {
    seconds = Number.parseFloat(seconds)
  }

  // Handle invalid input cases
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return "0:00.00"
  }

  // Ensure seconds is a positive number
  seconds = Math.max(0, seconds)

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  // Format with the specified precision
  const formattedSeconds = remainingSeconds.toFixed(precision)
  
  const secondsDisplay = remainingSeconds < 10 ? 
    `0${formattedSeconds}` : formattedSeconds
  
  return `${minutes}:${secondsDisplay}`
}

export function safeParseFloat(value: any): number {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === "number") {
    return isNaN(value) ? 0 : value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }

  return 0
}
