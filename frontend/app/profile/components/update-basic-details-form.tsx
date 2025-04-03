"use client"

import ErrorFeedback from "@/components/error-feedback"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuthGuard } from "@/lib/auth/use-auth"
import httpClient from "@/lib/httpClient"
import type { HttpErrorResponse } from "@/models/http/HttpErrorResponse"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { UserIcon, SaveIcon } from "lucide-react"
import { AxiosError } from "axios"

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
})

type Schema = z.infer<typeof schema>

interface LocalUserData {
  firstName: string
  lastName: string
  updatedAt: string
}

export default function UpdateBasicDetailsForm() {
  const { user, mutate } = useAuthGuard({ middleware: "auth" })
  const [errors, setErrors] = useState<HttpErrorResponse | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localUserData, setLocalUserData] = useState<LocalUserData | null>(null)

  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit",
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  })

  useEffect(() => {
    const storedData = localStorage.getItem("userProfileData")
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData) as LocalUserData
        setLocalUserData(parsedData)
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (localUserData) {
      const updatedTime = new Date(localUserData.updatedAt).getTime()
      const currentTime = new Date().getTime()
      const oneHour = 60 * 60 * 1000

      if (currentTime - updatedTime < oneHour) {
        form.reset({
          firstName: localUserData.firstName,
          lastName: localUserData.lastName,
        })
        return
      }
    }

    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      })
    }
  }, [user, localUserData, form])

  const fetchUserDirectly = async () => {
    if (!user?.id) return

    try {
      const response = await httpClient.get(`/api/users/${user.id}`)
      const userData = response.data.user || response.data

      const localData = {
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        updatedAt: new Date().toISOString(),
      }

      localStorage.setItem("userProfileData", JSON.stringify(localData))
      setLocalUserData(localData)

      form.reset({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
      })
    } catch (error) {}
  }

  const onSubmit = async (data: Schema) => {
    if (!user) return

    setErrors(undefined)
    setIsSubmitting(true)

    try {
      await httpClient.put(`/api/users/${user.id}`, data)

      const localData = {
        firstName: data.firstName,
        lastName: data.lastName,
        updatedAt: new Date().toISOString(),
      }

      localStorage.setItem("userProfileData", JSON.stringify(localData))
      setLocalUserData(localData)

      form.reset({
        firstName: data.firstName,
        lastName: data.lastName,
      })

      await mutate()
      await fetchUserDirectly()

      toast.success("Profile updated successfully")

      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data) {
        const errData = error.response.data as HttpErrorResponse
        setErrors(errData)
      }
      toast.error("Failed to update profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <ErrorFeedback data={errors} />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting ? (
                <>Updating...</>
              ) : (
                <>
                  <SaveIcon className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

