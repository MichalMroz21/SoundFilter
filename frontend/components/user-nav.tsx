"use client"

import { useAuthGuard } from "@/lib/auth/use-auth"
import Link from "next/link"
import { Button } from "./ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { LogOut, Settings, CreditCard, UserCircle } from "lucide-react"

export function UserNav() {
  const { user, logout } = useAuthGuard({ middleware: "auth" })

  const getInitials = () => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase()
    } else {
      return "U"
    }
  }

  const getDisplayName = () => {
    if (user?.firstName) {
      return user.firstName
    } else {
      return "User"
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full border border-primary/10 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Avatar className="h-9 w-9 transition-transform hover:scale-105">
            <AvatarImage src={getDisplayName()}/>
            <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
        {user?.email && (
          <>
            <div className="flex items-center justify-start gap-3 p-2 mb-1">
              <Avatar className="h-10 w-10 border border-primary/10">
                <AvatarImage src={getDisplayName()}/>
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
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

