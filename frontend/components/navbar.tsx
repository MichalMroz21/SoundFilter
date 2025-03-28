import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import React from "react";
import Logo from "./logo";
import Container from "./container";
import ModeToggle from "./mode-toggle";
import Link from "next/link";

interface NavbarProps extends React.HTMLAttributes<HTMLDivElement> {}
export default function Navbar({ className, ...props}: NavbarProps) {
    return (
        <div className={cn(
            className
        )} {...props}>
            <Container size="lg" className="flex justify-between items-center bg-card py-2 px-4 z-10">
                <Logo/>

                <div className="flex gap-x-2 items-center">

                    <Link href={"/auth/login"}>
                        <Button variant={"outline"}>Login</Button>
                    </Link>

                    <ModeToggle/>
                    
                </div>
            </Container>
        </div>
    );
}