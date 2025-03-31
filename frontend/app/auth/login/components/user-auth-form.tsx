"use client"

import * as React from "react"

import * as z from "zod"
import { toast } from "sonner"
import { useAuthGuard } from "@/lib/auth/use-auth"
import type { HttpErrorResponse } from "@/models/http/HttpErrorResponse"
import ErrorFeedback from "@/components/error-feedback"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Label } from "@/components/ui/label"
import { AtSignIcon, KeyIcon, Loader2Icon } from "lucide-react"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type Schema = z.infer<typeof loginFormSchema>
export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const { login } = useAuthGuard({ middleware: "guest", redirectIfAuthenticated: "/profile" })
  const [errors, setErrors] = React.useState<HttpErrorResponse | undefined>(undefined)

  async function onSubmit(data: Schema) {
    login({
      onError: (errors) => {
        setErrors(errors)
        if (errors) {
          toast.error("Authentication failed")
        }
      },
      props: data,
    })
  }

  const { register, handleSubmit, formState } = useForm<Schema>({
    resolver: zodResolver(loginFormSchema),
    reValidateMode: "onSubmit",
  })

  return (
    <div className="grid gap-6">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
              </div>

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
          </div>

          <ErrorFeedback data={errors} />

          <Button disabled={isLoading} type="submit" className="w-full">
            {isLoading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in with Email"
            )}
          </Button>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>

        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
    </div>
  )
}

