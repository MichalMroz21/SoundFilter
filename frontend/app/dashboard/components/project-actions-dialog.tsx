"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Share2, ExternalLink, Save, AlertTriangle } from "lucide-react"
import type { AudioProject } from "@/models/user/UserResponse"
import { useAuthGuard } from "@/lib/auth/use-auth"
import httpClient from "@/lib/httpClient"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ProjectActionsDialogProps {
  project: AudioProject
  projectIndex: number
  isOpen: boolean
  onClose: () => void
  onProjectChange?: () => Promise<any>
}

export function ProjectActionsDialog({
  project,
  projectIndex,
  isOpen,
  onClose,
  onProjectChange,
}: ProjectActionsDialogProps) {
  const router = useRouter()
  const { mutate } = useAuthGuard({ middleware: "auth" })
  const [activeTab, setActiveTab] = useState("actions")
  const [projectName, setProjectName] = useState(project.name)
  const [projectDescription, setProjectDescription] = useState(project.description || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Update local state when project props change
  useEffect(() => {
    setProjectName(project.name)
    setProjectDescription(project.description || "")
  }, [project])

  const handleEditProject = () => {
    router.push(`/dashboard/projects/${projectIndex}`)
    onClose()
  }

  const handleDeleteProject = async () => {
    setIsDeleting(true)

    try {
      // Call the API to delete the project
      await httpClient.delete(`/api/users/${project.id}/delete-project`)

      toast.success("Project deleted successfully")

      // Close the dialog
      onClose()

      // First, clear any cached data for this project
      if (typeof window !== "undefined") {
        try {
          const projectsCache = localStorage.getItem("projectsCache")
          if (projectsCache) {
            const cache = JSON.parse(projectsCache)
            if (cache[project.id]) {
              delete cache[project.id]
              localStorage.setItem("projectsCache", JSON.stringify(cache))
            }
          }
        } catch (e) {
          // Silent error - continue with refresh
        }
      }

      // Force a direct refresh of user data
      if (onProjectChange) {
        await onProjectChange()
      } else {
        // Force a complete revalidation
        await mutate(undefined, { revalidate: true })

        // If no callback provided, refresh the page
        if (typeof window !== "undefined") {
          window.location.reload()
        }
      }
    } catch (error) {
      console.error("Error deleting project:", error)
      toast.error("Failed to delete project")
      setIsDeleting(false)
    }
  }

  const handleShareProject = () => {
    // Placeholder for share functionality
    toast.info("Share functionality will be implemented in the backend")
    // Here you would implement sharing logic
    onClose()
  }

  const handleUpdateDetails = async () => {
    setIsSubmitting(true)

    try {
      // Call the backend API to update project details
      await httpClient.patch(`/api/users/${project.id}/project-details`, {
        name: projectName,
        description: projectDescription,
      })

      toast.success("Project details updated successfully")

      // Store updated project data in localStorage
      if (typeof window !== "undefined") {
        const projectsCache = localStorage.getItem("projectsCache")
          ? JSON.parse(localStorage.getItem("projectsCache") || "{}")
          : {}

        projectsCache[project.id] = {
          name: projectName,
          description: projectDescription,
          updatedAt: new Date().toISOString(),
        }

        localStorage.setItem("projectsCache", JSON.stringify(projectsCache))
      }

      // Close the dialog
      onClose()

      // Force a direct refresh of user data
      if (onProjectChange) {
        await onProjectChange()
      } else {
        // Force a complete revalidation
        await mutate(undefined, { revalidate: true })

        // If no callback provided, refresh the page
        if (typeof window !== "undefined") {
          window.location.reload()
        }
      }
    } catch (error) {
      console.error("Error updating project:", error)
      toast.error("Failed to update project details")
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{projectName}</DialogTitle>
            <DialogDescription>Manage your audio project</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="details">Edit Details</TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <Button onClick={handleEditProject} className="flex items-center justify-start gap-2 h-auto py-3">
                  <ExternalLink className="h-5 w-5" />
                  <div className="flex flex-col items-start">
                    <span>Edit Project</span>
                    <span className="text-xs text-muted-foreground">Open the project editor</span>
                  </div>
                </Button>

                <Button
                  onClick={handleShareProject}
                  variant="outline"
                  className="flex items-center justify-start gap-2 h-auto py-3"
                >
                  <Share2 className="h-5 w-5" />
                  <div className="flex flex-col items-start">
                    <span>Share Project</span>
                    <span className="text-xs text-muted-foreground">Share with others</span>
                  </div>
                </Button>

                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="destructive"
                  className="flex items-center justify-start gap-2 h-auto py-3"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>Deleting...</>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Delete Project</span>
                        <span className="text-xs text-muted-foreground">Permanently delete this project</span>
                      </div>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectDescription">Description</Label>
                  <Textarea
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>

                <Button onClick={handleUpdateDetails} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>Updating...</>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and all associated data will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

