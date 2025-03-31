"use client"

import ErrorFeedback from "@/components/error-feedback"
import SuccessFeedback from "@/components/success-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import httpClient from "@/lib/httpClient"
import type { HttpErrorResponse } from "@/models/http/HttpErrorResponse"
import { zodResolver } from "@hookform/resolvers/zod"
import React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { KeyIcon, Loader2Icon, MailIcon } from "lucide-react"
import Link from "next/link"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})
type Schema = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [errors, setErrors] = React.useState<HttpErrorResponse | undefined>()
  const [success, setSuccess] = React.useState<boolean>(false)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onSubmit(data: Schema) {
    setIsLoading(true)
    httpClient
      .post("/api/users/forgot-password", data)
      .then(() => {
        setSuccess(true)
      })
      .catch((error) => {
        const errData = error.response.data as HttpErrorResponse
        setErrors(errData)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const { register, handleSubmit, formState } = useForm<Schema>({
    resolver: zodResolver(forgotPasswordSchema),
    reValidateMode: "onSubmit",
  })

  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-80px)] py-12">
      <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
        
        <div className="flex flex-col items-center space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>

          <p className="text-muted-foreground max-w-xs">
            Enter your email address and we'll send you a link to reset your password
          </p>

        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8">
          <div className="grid gap-6">
            <SuccessFeedback
              show={success}
              message="Password reset email sent"
              description="Please check your inbox and follow the instructions in the email to reset your password."
            />

            {!success && (
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
                  <div className="space-y-2">

                    <Label htmlFor="email" className="text-sm font-medium">
                      Email address
                    </Label>

                    <div className="relative">

                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <MailIcon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <Input
                        id="email"
                        placeholder="name@example.com"
                        type="text"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        className="pl-10"
                        disabled={isLoading}
                        {...register("email")}
                      />
                    </div>

                    {formState.errors.email && (
                      <small className="text-destructive text-xs">{formState.errors.email.message}</small>
                    )}

                  </div>

                  <ErrorFeedback data={errors} />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>

                </div>
              </form>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-x-2 items-center text-sm">
          <span className="text-muted-foreground">Remember your password?</span>

          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Back to login
          </Link>
        </div>

      </div>
    </div>
  )
}

