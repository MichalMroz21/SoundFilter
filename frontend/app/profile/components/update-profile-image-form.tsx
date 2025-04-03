"use client"

import type React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { useAuthGuard } from "@/lib/auth/use-auth"
import httpClient from "@/lib/httpClient"
import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LocalUserData {
  firstName: string
  lastName: string
  updatedAt: string
}

export default function UpdateProfileImageForm() {
  const { user, mutate } = useAuthGuard({ middleware: "auth" })
  const [isUploading, setIsUploading] = useState(false)
  const [localUserData, setLocalUserData] = useState<LocalUserData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkLocalStorage = () => {
      const storedData = localStorage.getItem("userProfileData")
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as LocalUserData
          setLocalUserData(parsedData)
        } catch (e) {}
      }
    }

    checkLocalStorage()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "userProfileData") {
        checkLocalStorage()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const handleLogoChange = (file: File) => {
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    httpClient
      .patch(`/api/users/${user?.id}/profile-picture`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then(() => {
        toast.success("Profile picture updated successfully")
        mutate()
      })
      .catch((error) => {
        toast.error("Failed to update profile picture")
      })
      .finally(() => {
        setIsUploading(false)
      })
  }

  const getInitials = () => {
    if (localUserData) {
      const updatedTime = new Date(localUserData.updatedAt).getTime()
      const currentTime = new Date().getTime()
      const oneHour = 60 * 60 * 1000

      if (currentTime - updatedTime < oneHour) {
        if (localUserData.firstName && localUserData.lastName) {
          return `${localUserData.firstName.charAt(0)}${localUserData.lastName.charAt(0)}`.toUpperCase()
        } else if (localUserData.firstName) {
          return localUserData.firstName.charAt(0).toUpperCase()
        }
      }
    }

    if (!user) return "U"
    if (user.firstName && user.lastName) return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    return user.firstName?.charAt(0).toUpperCase() || "U"
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    const allowedTypes = ["image/png", "image/jpg", "image/jpeg"]
    if (!allowedTypes.includes(file.type)) {
      toast.error(`File type not supported. Please upload one of: ${allowedTypes.join(", ")}`)
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit")
      return
    }

    handleLogoChange(file)
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative">

        <Avatar className="w-20 h-20 border-2 border-primary/10">
          <AvatarImage src={user?.profileImageUrl} />
          <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">{getInitials()}</AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <Label className="text-base font-medium">Profile Picture</Label>
          <p className="text-sm text-muted-foreground">Click on the button below to upload a new profile picture</p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          accept="image/png,image/jpg,image/jpeg"
        />

        <Button variant="outline" className="w-full" onClick={triggerFileInput} disabled={isUploading}>
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload New Picture"}
        </Button>

        <p className="text-xs text-muted-foreground">Supported formats: JPG, JPEG, PNG. Max size: 5MB.</p>
      </div>
    </div>
  )
}

