"use client"

import UpdateBasicDetailsForm from "./components/update-basic-details-form"
import UpdatePasswordForm from "./components/update-password-form"
import { useAuthGuard } from "@/lib/auth/use-auth"
import { FaFacebook, FaGithub, FaGoogle } from "react-icons/fa"
import { format } from "date-fns"
import Loading from "@/components/loading"
import Container from "@/components/container"
import UpdateProfileImageForm from "./components/update-profile-image-form"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"

export default function ProfilePage() {
  const { user } = useAuthGuard({ middleware: "auth" })

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "google":
        return <FaGoogle className="h-4 w-4 text-[#DB4437]" />
      case "github":
        return <FaGithub className="h-4 w-4 text-[#333]" />
      case "facebook":
        return <FaFacebook className="h-4 w-4 text-[#4267B2]" />
      case "okta":
        return <span className="text-sm font-medium">Okta</span>
      default:
        return <span className="text-sm font-medium">{provider}</span>
    }
  }

  if (!user) return <Loading />

  const connectedAccounts = user.connectedAccounts || []

  return (
    <Container size="sm">
      <div className="flex flex-col gap-y-8 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <Card className="p-6">

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Profile Picture</h2>
              <p className="text-sm text-muted-foreground">Upload a profile picture to personalize your account</p>
            </div>

            <UpdateProfileImageForm />

          </div>
        </Card>

        <Card className="p-6">

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Personal Information</h2>
              <p className="text-sm text-muted-foreground">Update your personal details</p>
            </div>

            <Separator />
            <UpdateBasicDetailsForm />

          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Security</h2>
              <p className="text-sm text-muted-foreground">Manage your password and account security</p>
            </div>

            <Separator />
            <UpdatePasswordForm />
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Connected Accounts</h2>
            </div>

            <Separator />

            <div className="flex flex-col gap-y-3 pt-2">
              {connectedAccounts.map((account, index) => (
                <div key={index} className="flex w-full justify-between items-center p-3 bg-muted/40 rounded-md">

                  <div className="flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                      {getProviderIcon(account.provider)}
                    </div>

                    <span className="font-medium capitalize">{account.provider}</span>
                  </div>

                  <span className="text-sm text-muted-foreground">
                    Connected on{" "}
                    <span className="text-foreground font-medium">
                      {format(new Date(account.connectedAt), "MMM dd, yyyy")}
                    </span>     
                  </span>
                </div>
              ))}

              {connectedAccounts.length === 0 && (
                <div className="text-muted-foreground text-center py-4 bg-muted/40 rounded-md">
                  No connected accounts found. 
                </div>
              )}

            </div>
          </div>
        </Card>
      </div>
    </Container>
  )
}

