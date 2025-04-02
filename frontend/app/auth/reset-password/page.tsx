"use client"
import { ResetPasswordForm } from "./components/ResetPasswordForm"
import { KeyIcon } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-80px)] py-12">
      <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
        <div className="flex flex-col items-center space-y-4 text-center">

          <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground max-w-xs">
            Enter your new password below to complete the password reset process
          </p>
          
        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}

