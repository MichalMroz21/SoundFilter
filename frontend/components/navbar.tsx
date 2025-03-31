"use client"

import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import type React from "react"
import Logo from "./logo"
import Container from "./container"
import ModeToggle from "./mode-toggle"
import Link from "next/link"
import { useAuthGuard } from "@/lib/auth/use-auth"
import { UserNav } from "./user-nav"

interface NavbarProps extends React.HTMLAttributes<HTMLDivElement> {}
export default function Navbar({ className, ...props }: NavbarProps) {
  const { user } = useAuthGuard({ middleware: "guest" })

  return (
    <div
      className={cn(
        "border-b backdrop-blur-sm bg-background/80 sticky top-0 z-50 transition-all duration-300",
        className,
      )}
      {...props}
    >
      <Container size="lg" className="flex justify-between items-center py-3 px-4 z-10">
        <Logo />

        <div className="flex gap-x-3 items-center">
          {user && <UserNav />}

          {!user && (
            <Link href={"/auth/login"}>
              <Button variant={"default"} className="relative overflow-hidden group">
                <span className="relative z-10">Login</span>
                <span className="absolute inset-0 w-full h-full bg-white/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
              </Button>
            </Link>
          )}

          <ModeToggle />
        </div>
      </Container>
    </div>
  )
}

