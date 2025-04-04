"use client"

import { Card } from "@/components/ui/card"
import { PlusIcon } from "lucide-react"

interface AddProjectCardProps {
  onClick: () => void
}

export function AddProjectCard({ onClick }: AddProjectCardProps) {
  return (
    <Card
      className="overflow-hidden transition-all hover:shadow-md cursor-pointer group flex flex-col items-center justify-center h-full min-h-[240px] border-dashed"
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-primary/10 p-4 rounded-full mb-4">
          <PlusIcon className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
        </div>
        <h3 className="font-semibold text-lg">Add New Project</h3>
        <p className="text-sm text-muted-foreground mt-1">Upload a new audio file</p>
      </div>
    </Card>
  )
}

