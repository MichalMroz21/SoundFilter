"use client"

import Link from "next/link"
import Image from "next/image"

export default function Logo() {
  return (
    <Link href={"/"} className="flex items-center gap-3 group">
      <div className="relative w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-105">
        <Image src="/images/logo.png" alt="SoundFilter Logo" width={40} height={40} className="object-cover" />
      </div>
      <span className="font-bold text-xl tracking-tight text-foreground transition-all duration-300">SoundFilter</span>
    </Link>
  )
}

