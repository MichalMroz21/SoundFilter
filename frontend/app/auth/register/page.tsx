import React from "react";
import { UserRegisterForm } from "./components/register-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="mt-4 md:mt-0 space-y-6 flex flex-col justify-center h-full max-w-screen-sm mx-auto">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create account
        </h1>
      </div>
      
      <UserRegisterForm />

      <p className="flex justify-center gap-x-2">
        Already have an account?
        <Link href="/auth/login" className="underline">
          Login
        </Link>
      </p>
    </div>
  );
}