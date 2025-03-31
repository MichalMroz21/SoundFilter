"use client"
import { UserRegisterForm } from "./components/register-form"
import Link from "next/link"
import { AudioWaveformIcon } from "lucide-react"

export default function RegisterPage() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-80px)] py-12">
      <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
        <div className="flex flex-col items-center space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>

          <p className="text-muted-foreground max-w-xs">
            Join SoundFilter to start transforming your audio files today
          </p>

        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8">
          <UserRegisterForm />
        </div>

        <div className="flex justify-center gap-x-2 items-center text-sm">
          <span className="text-muted-foreground">Already have an account?</span>
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
        
      </div>
    </div>
  )
}

