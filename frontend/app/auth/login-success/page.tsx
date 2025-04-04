"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { IoShieldCheckmark } from "react-icons/io5"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { HomeIcon, ArrowRightIcon } from "lucide-react"

export default function LoginSuccessPage() {
  const [counter, setCounter] = useState(3)
  const [progress, setProgress] = useState(0)
  const router = useRouter()
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Set up the counter interval
    redirectTimeoutRef.current = setInterval(() => {
      setCounter((prevCounter) => {
        const newCount = prevCounter - 1
        if (newCount <= 0) {
          if (redirectTimeoutRef.current) {
            clearInterval(redirectTimeoutRef.current)
          }
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
          }
          router.push("/dashboard")
        }
        return newCount
      })
    }, 1000)

    // Set up the progress interval
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 100 / 30 // Smoother progress (30 steps over 3 seconds)
        return newProgress > 100 ? 100 : newProgress
      })
    }, 100)

    // Clean up intervals on unmount
    return () => {
      if (redirectTimeoutRef.current) {
        clearInterval(redirectTimeoutRef.current)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [router])

  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full justify-center items-center">
      <div className="max-w-md w-full mx-auto p-8 rounded-xl bg-card border shadow-lg flex flex-col items-center gap-6 text-center">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
          <IoShieldCheckmark className="text-5xl text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Login Successful!</h2>
          <p className="text-muted-foreground">
            Welcome back to SoundFilter. You'll be redirected to your dashboard shortly.
          </p>
        </div>

        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2 w-full" />
          <p className="text-sm text-muted-foreground">
            Redirecting in <span className="font-medium text-foreground">{counter}</span> seconds...
          </p>
        </div>

        <div className="flex gap-4 w-full">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/">
              <HomeIcon className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>

          <Button className="flex-1" asChild>
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

