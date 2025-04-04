"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { AudioProject } from "@/models/user/UserResponse"
import { AudioWaveformIcon, Calendar, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface AudioProjectCardProps {
  project: AudioProject
  onClick: () => void
}

export function AudioProjectCard({ project, onClick }: AudioProjectCardProps) {
  // Format dates
  const createdAt = new Date(project.createdAt)
  const updatedAt = new Date(project.updatedAt)

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer group" onClick={onClick}>
      <div className="bg-primary/10 p-6 flex items-center justify-center">
        <AudioWaveformIcon className="h-16 w-16 text-primary transition-transform group-hover:scale-110" />
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg truncate">{project.name}</h3>
        <p className="text-sm text-muted-foreground truncate mt-1">
          {project.description || "No description"} • {project.extension.toUpperCase()}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col items-start gap-2 border-t mt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Created {formatDistanceToNow(createdAt, { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}</span>
        </div>
      </CardFooter>
    </Card>
  )
}

