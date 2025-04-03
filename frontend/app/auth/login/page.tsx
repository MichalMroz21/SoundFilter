"use client"

import Link from "next/link"
import { UserAuthForm } from "./components/user-auth-form"
import { AudioWaveformIcon } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-80px)] py-12">
      <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
        <div className="flex flex-col items-center space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>

          <p className="text-muted-foreground max-w-xs">
            Enter your credentials below to access Your SoundFilter account
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8">
          <UserAuthForm />
        </div>

        <div className="flex flex-col space-y-3 text-center text-sm">
          <p className="flex justify-center gap-x-2 items-center">
            <span className="text-muted-foreground">Don't have an account?</span>
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>

          <p className="flex justify-center gap-x-2 items-center">
            <span className="text-muted-foreground">Forgot your password?</span>
            <Link href="/auth/forgot-password" className="text-primary hover:underline font-medium">
              Reset it
            </Link>
          </p>
          
        </div>
      </div>
    </div>
  )
}

