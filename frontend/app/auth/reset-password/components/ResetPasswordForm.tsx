"use client"

import ErrorFeedback from "@/components/error-feedback"
import SuccessFeedback from "@/components/success-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import httpClient from "@/lib/httpClient"
import type { HttpErrorResponse } from "@/models/http/HttpErrorResponse"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { KeyIcon, Loader2Icon } from "lucide-react"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    passwordResetToken: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type Schema = z.infer<typeof resetPasswordSchema>
export function ResetPasswordForm() {
  const [errors, setErrors] = React.useState<HttpErrorResponse | undefined>(undefined)
  const [success, setSuccess] = React.useState<boolean>(false)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const token = useSearchParams().get("token")

  function onSubmit(data: Schema) {
    setIsLoading(true)
    httpClient
      .patch("/api/users/reset-password", data)
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
    resolver: zodResolver(resetPasswordSchema),
    reValidateMode: "onSubmit",
    defaultValues: {
      passwordResetToken: token || undefined,
    },
  })

  return (
    <div className="grid gap-6">
      <SuccessFeedback
        show={success}
        message="Password updated successfully"
        description="Your password has been reset. You can now log in with your new password."
        action={
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Go to login
          </Link>
        }
      />

      {!success && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="space-y-2">

              <Label htmlFor="password" className="text-sm font-medium">
                New password
              </Label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <Input id="password" type="password" className="pl-10" disabled={isLoading} {...register("password")} />
              </div>

              {formState.errors.password && (
                <small className="text-destructive text-xs">{formState.errors.password.message}</small>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </Label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <Input
                  id="confirmPassword"
                  type="password"
                  className="pl-10"
                  disabled={isLoading}
                  {...register("confirmPassword")}
                />
              </div>

              {formState.errors.confirmPassword && (
                <small className="text-destructive text-xs">{formState.errors.confirmPassword.message}</small>
              )}
            </div>

            <ErrorFeedback data={errors} />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
            
          </div>
        </form>
      )}
    </div>
  )
}

