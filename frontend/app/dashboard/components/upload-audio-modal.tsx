"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuthGuard } from "@/lib/auth/use-auth"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { AudioWaveformIcon, Loader2Icon, UploadIcon } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import httpClient from "@/lib/httpClient"

interface UploadAudioModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UploadAudioModal({ isOpen, onClose }: UploadAudioModalProps) {
  const { user, mutate } = useAuthGuard({ middleware: "auth" })
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [projectName, setProjectName] = useState("")
  const [description, setDescription] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]

      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error("File size exceeds 50MB limit")
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }

      setSelectedFile(file)

      if (!projectName) {
        const fileName = file.name
        const nameWithoutExtension = fileName.split(".").slice(0, -1).join(".")
        setProjectName(nameWithoutExtension || fileName)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true
    }

    if (isUploading) {
      return 
    }

    if (!selectedFile) {
      toast.error("Please select an audio file")
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false
      }
      return
    }

    if (!projectName.trim()) {
      toast.error("Please enter a project name")
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false
      }
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      console.log("Preparing to upload audio project...")
      console.log("File name:", selectedFile.name)
      console.log("File size:", (selectedFile.size / 1024 / 1024).toFixed(2) + " MB")
      console.log("Project name:", projectName)
      console.log("Description:", description || "(empty)")

      const formData = new FormData()

      formData.append("file", selectedFile)
      formData.append("name", projectName)
      formData.append("description", description || "")

      abortControllerRef.current = new AbortController()

      const response = await httpClient.post("/api/users/create-audio-project", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        signal: abortControllerRef.current.signal,
        timeout: 300000, 
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total !== undefined) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(percentCompleted)
            console.log(`Upload progress: ${percentCompleted}%`)
          } else {
            console.log(`Uploaded ${(progressEvent.loaded / (1024 * 1024)).toFixed(2)} MB`)
            setUploadProgress(-1) 
          }
        },
      })

      console.log("Upload complete!", response.data)
      toast.success("Audio project created successfully")
      mutate() 
      resetForm()
      onClose()
    } catch (error: any) {
      console.error("Error uploading audio:", error)

      if (error.name === "AbortError" || error.code === "ECONNABORTED") {
        toast.info("Upload was cancelled")
      } else {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create audio project"

        toast.error(errorMessage)
      }
    } finally {
      setIsUploading(false)
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false
      }
      abortControllerRef.current = null
    }
  }

  const cancelUpload = () => {
    if (abortControllerRef.current && isUploading) {
      abortControllerRef.current.abort()
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setProjectName("")
    setDescription("")
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = () => {
    if (isUploading) {
      if (window.confirm("Upload in progress. Are you sure you want to cancel?")) {
        cancelUpload()
        resetForm()
        onClose()
      }
    } else {
      resetForm()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Audio Project</DialogTitle>
          <DialogDescription>Upload an audio file to create a new project</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="file">Audio File</Label>
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-4">
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2 w-full">
                  <AudioWaveformIcon className="h-10 w-10 text-primary" />
                  <div className="text-center">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    disabled={isUploading}
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <>
                  <UploadIcon className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">MP3, WAV, or FLAC (max. 50MB)</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    Select File
                  </Button>
                </>
              )}
              <input
                id="file"
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isUploading}
              placeholder="Enter project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              placeholder="Enter project description"
              rows={3}
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                {uploadProgress >= 0 ? <span>{uploadProgress}%</span> : <span>In progress...</span>}
              </div>
              {uploadProgress >= 0 ? (
                <Progress value={uploadProgress} className="h-2" />
              ) : (
                <div className="h-2 w-full bg-secondary overflow-hidden relative">
                  <div className="h-full bg-primary absolute left-0 animate-progress-indeterminate" />
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center mt-1">
                Please keep this window open until the upload completes
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {isUploading ? "Cancel Upload" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isUploading || !selectedFile} className="relative" ref={submitButtonRef}>
              {isUploading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

