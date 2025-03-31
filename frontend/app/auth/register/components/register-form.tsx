"use client"

import ErrorFeedback from "@/components/error-feedback"
import SuccessFeedback from "@/components/success-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import httpClient from "@/lib/httpClient"
import { cn } from "@/lib/utils"
import type { HttpErrorResponse } from "@/models/http/HttpErrorResponse"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AtSignIcon, KeyIcon, UserIcon, Loader2Icon } from "lucide-react"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  })

type Schema = z.infer<typeof registerSchema>

export function UserRegisterForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [success, setSuccess] = React.useState<boolean>(false)
  const [errors, setErrors] = React.useState<HttpErrorResponse | undefined>(undefined)

  async function onSubmit(data: Schema) {
    setErrors(undefined)
    setSuccess(false)
    setIsLoading(true)

    httpClient
      .post("/api/users", data)
      .then(() => {
        toast.success("Account created successfully")
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
    resolver: zodResolver(registerSchema),
    reValidateMode: "onSubmit",
  })

  if (success) {
    return (
      <SuccessFeedback
        show={success}
        message="Account created successfully!"
        description="A verification email has been sent to your inbox. Please click the link in the email to verify your account."
        action={
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Sign in now
          </Link>
        }
      />
    )
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <div className="space-y-4">
            <div className="space-y-2">

              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <AtSignIcon className="h-4 w-4 text-muted-foreground" />
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

            <div className="space-y-2">

              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <Input
                  id="password"
                  type="password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-10"
                  disabled={isLoading}
                  {...register("password")}
                />
              </div>

              {formState.errors.password && (
                <small className="text-destructive text-xs">{formState.errors.password.message}</small>
              )}

            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirmation" className="text-sm font-medium">
                Confirm password
              </Label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <Input
                  id="passwordConfirmation"
                  type="password"
                  className="pl-10"
                  disabled={isLoading}
                  {...register("passwordConfirmation")}
                />
              </div>

              {formState.errors.passwordConfirmation && (
                <small className="text-destructive text-xs">{formState.errors.passwordConfirmation.message}</small>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </Label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    className="pl-10"
                    disabled={isLoading}
                    {...register("firstName")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </Label>

                <div className="relative">

                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    className="pl-10"
                    disabled={isLoading}
                    {...register("lastName")}
                  />

                </div>
              </div>
            </div>
          </div>

          <ErrorFeedback data={errors} />

          <Button disabled={isLoading} type="submit" className="w-full">
            {isLoading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>

        </div>
      </form>
    </div>
  )
}

