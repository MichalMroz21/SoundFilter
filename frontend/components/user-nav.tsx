"use client"

import { useAuthGuard } from "@/lib/auth/use-auth"
import Link from "next/link"
import { Button } from "./ui/button"
import { useEffect, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { LogOut, UserCircle, LayoutDashboard } from "lucide-react"

interface LocalUserData {
  firstName: string
  lastName: string
  updatedAt: string
}

export function UserNav() {
  const { user, logout } = useAuthGuard({ middleware: "auth" })
  const [localUserData, setLocalUserData] = useState<LocalUserData | null>(null)

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

    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    } else if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase()
    } else {
      return "U"
    }
  }

  const getDisplayName = () => {
    if (localUserData) {
      const updatedTime = new Date(localUserData.updatedAt).getTime()
      const currentTime = new Date().getTime()
      const oneHour = 60 * 60 * 1000

      if (currentTime - updatedTime < oneHour) {
        if (localUserData.firstName && localUserData.lastName) {
          return `${localUserData.firstName} ${localUserData.lastName}`
        } else if (localUserData.firstName) {
          return localUserData.firstName
        }
      }
    }

    if (user?.firstName && user?.lastName) { return `${user.firstName} ${user.lastName}` } 
    else if (user?.firstName) { return user.firstName } 
    else { return "User" }
  }

  const initials = getInitials()
  const displayName = getDisplayName()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full border border-primary/10 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Avatar className="h-9 w-9 transition-transform hover:scale-105">
            <AvatarImage src={user?.profileImageUrl || ""} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
        {user?.email && (
          <>
            <div className="flex items-center justify-start gap-3 p-2 mb-1">
              <Avatar className="h-10 w-10 border border-primary/10">
                <AvatarImage src={user?.profileImageUrl || ""} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="my-1" />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-md focus:bg-accent">
            <Link href="/profile" className="flex items-center gap-2 w-full">
              <UserCircle className="h-4 w-4 text-primary" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-md focus:bg-accent">
            <Link href="/dashboard" className="flex items-center gap-2 w-full">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => logout()}
          className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

