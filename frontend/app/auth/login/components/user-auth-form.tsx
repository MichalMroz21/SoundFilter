"use client";

import * as React from "react";

import * as z from "zod";
import { toast } from "sonner";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { HttpErrorResponse } from "@/models/http/HttpErrorResponse";
import ErrorFeedback from "@/components/error-feedback";
import Link from "next/link";
import { Button, TextInput } from "@mantine/core";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type Schema = z.infer<typeof loginFormSchema>;
export function UserAuthForm({ className, ...props }: UserAuthFormProps) {

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const {login} = useAuthGuard({middleware: 'guest', redirectIfAuthenticated: '/profile'});
  const [errors, setErrors] = React.useState<HttpErrorResponse | undefined>(undefined);

  async function onSubmit(data: Schema) {
    login({
      onError: (errors) => {
        setErrors(errors)
        if (errors) {
          toast.error("Authentication failed");
        }
      },
      props: data,
    })
  }

  const { register, handleSubmit, formState } = useForm<Schema>({
    resolver: zodResolver(loginFormSchema),
    reValidateMode: "onSubmit"
  });

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <TextInput
              id="email"
              placeholder="name@example.com"
              type="text"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              label="Email"
              {...register("email")}
            />
            {formState.errors.email && (
                <small className="text-red-600">
                    {formState.errors.email.message}
                </small>
            )}

            <Label htmlFor="password">Password</Label>
            <TextInput
              id="password"
              type="password"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={isLoading}
              label="Password"
              {...register("password")}
            />
          </div>
          {formState.errors.password && (
                <small className="text-red-600">
                    {formState.errors.password.message}
                </small>
            )}
          <ErrorFeedback data={errors} />
          
          <Button disabled={isLoading} type="submit">
            {isLoading && 'Logging in...'}
            Sign In with Email
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
    </div>
  );
}