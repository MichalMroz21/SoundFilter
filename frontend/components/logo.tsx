"use client"

import Link from "next/link"

export default function Logo() {
    return (
        <Link href={"/"}>
            <img src="/images/logo.png" alt="soundfilter logo" className="w-10 h-10 rounded-md"></img>
        </Link>
    )
}