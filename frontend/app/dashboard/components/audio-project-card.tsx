"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { AudioProject } from "@/models/user/UserResponse"
import { AudioWaveformIcon, Calendar, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ProjectActionsDialog } from "./project-actions-dialog"

interface AudioProjectCardProps {
  project: AudioProject
  projectIndex: number
  onProjectChange?: () => Promise<any>
}

export function AudioProjectCard({ project, projectIndex, onProjectChange }: AudioProjectCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [displayName, setDisplayName] = useState(project.name)
  const [displayDescription, setDisplayDescription] = useState(project.description || "")

  // Check localStorage for cached project data
  useEffect(() => {
    if (typeof window === "undefined") return

    const checkCachedData = () => {
      const projectsCache = localStorage.getItem("projectsCache")
      if (projectsCache) {
        try {
          const cache = JSON.parse(projectsCache)
          if (cache[project.id]) {
            setDisplayName(cache[project.id].name)
            setDisplayDescription(cache[project.id].description || "")
          }
        } catch (e) {
          // Silent error - continue with existing data
        }
      }
    }

    // Check on mount
    checkCachedData()

    // Also set up a listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "projectsCache") {
        checkCachedData()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [project.id])

  // Update from props when they change
  useEffect(() => {
    if (typeof window === "undefined") return

    // Only update from props if we don't have cached data
    const projectsCache = localStorage.getItem("projectsCache")
    if (!projectsCache || !JSON.parse(projectsCache)[project.id]) {
      setDisplayName(project.name)
      setDisplayDescription(project.description || "")
    }
  }, [project, project.id])

  // Format dates
  const createdAt = new Date(project.createdAt)
  const updatedAt = new Date(project.updatedAt)

  return (
    <>
      <Card
        className="overflow-hidden transition-all hover:shadow-md cursor-pointer group"
        onClick={() => setIsDialogOpen(true)}
      >
        <div className="bg-primary/10 p-6 flex items-center justify-center">
          <AudioWaveformIcon className="h-16 w-16 text-primary transition-transform group-hover:scale-110" />
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg truncate">{displayName}</h3>
          <p className="text-sm text-muted-foreground truncate mt-1">
            {displayDescription || "No description"} • {project.extension.toUpperCase()}
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

      <ProjectActionsDialog
        project={{ ...project, name: displayName, description: displayDescription }}
        projectIndex={projectIndex}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onProjectChange={onProjectChange}
      />
    </>
  )
}

