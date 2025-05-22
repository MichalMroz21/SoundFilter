"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, VolumeX, Mic } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import httpClient from "@/lib/httpClient"
import { formatTime } from "@/lib/utils"
import { AxiosError } from "axios"

interface AudioRangeModificationProps {
  projectId: number
  startTime: number
  endTime: number
  onModificationComplete: () => Promise<void>
  onClose: () => void
}

// Interface for the UserResponse from the backend
interface UserResponse {
  id: number
  role: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
  connectedAccounts: Array<{
    provider: string
    connectedAt: string
  }>
  audioProjects: Array<{
    id: number
    name: string
    description: string
    extension: string
    createdAt: string
    updatedAt: string
    audioUrl: string
  }>
}

export function AudioRangeModification({
  projectId,
  startTime,
  endTime,
  onModificationComplete,
  onClose,
}: AudioRangeModificationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationType, setModificationType] = useState<"mute" | "tts">("mute")
  const [replacementText, setReplacementText] = useState("")
  const [useEdgeTts, setUseEdgeTts] = useState(true)
  const [gender, setGender] = useState<"male" | "female">("male")

  const handleMuteAudio = async () => {
    setIsProcessing(true)
    try {
      console.log("Sending mute request with:", {
        projectId,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
      })

      // Use query parameters instead of form data
      const response = await httpClient.post<UserResponse>(`/api/audio/${projectId}/mute-audio`, null, {
        params: {
          start_time: startTime,
          end_time: endTime,
        },
      })

      console.log("Mute response received:", response.data)

      // Extract the updated project from the response
      const userResponse = response.data as UserResponse
      const updatedProject = userResponse.audioProjects.find((project) => project.id === projectId)

      if (updatedProject) {
        console.log("Updated project audio URL:", updatedProject.audioUrl)

        // Update global state or local storage if needed
        try {
          // Example: Update localStorage cache
          const projectsCache = localStorage.getItem("projectsCache")
          if (projectsCache) {
            const cache = JSON.parse(projectsCache)
            if (cache[projectId]) {
              cache[projectId].audioUrl = updatedProject.audioUrl
              localStorage.setItem("projectsCache", JSON.stringify(cache))
              console.log("Updated project cache with new audio URL")
            }
          }
        } catch (e) {
          console.error("Error updating project cache:", e)
        }
      } else {
        console.warn("Updated project not found in response")
      }

      toast.success("Audio section muted successfully")
      await onModificationComplete()
      onClose()
    } catch (error) {
      console.error("Error muting audio:", error)

      // Improved error handling with type checking
      if (error instanceof AxiosError) {
        console.error("Error response:", error.response?.data)
        console.error("Error status:", error.response?.status)
        console.error("Error headers:", error.response?.headers)
        toast.error(`Failed to mute audio section: ${error.response?.status} ${error.response?.statusText}`)
      } else {
        toast.error("Failed to mute audio section")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReplaceWithTts = async () => {
    if (!replacementText.trim()) {
      toast.error("Replacement text cannot be empty")
      return
    }

    setIsProcessing(true)
    try {
      console.log("Sending TTS replacement request with:", {
        projectId,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        replacementText,
        useEdgeTts: useEdgeTts.toString(),
        gender,
      })

      // Use query parameters instead of form data
      const response = await httpClient.post<UserResponse>(`/api/audio/${projectId}/replace-with-tts`, null, {
        params: {
          start_time: startTime,
          end_time: endTime,
          replacement_text: replacementText,
          use_edge_tts: useEdgeTts,
          gender: gender,
        },
      })

      console.log("TTS response received:", response.data)

      // Extract the updated project from the response
      const userResponse = response.data as UserResponse
      const updatedProject = userResponse.audioProjects.find((project) => project.id === projectId)

      if (updatedProject) {
        console.log("Updated project audio URL:", updatedProject.audioUrl)

        // Update global state or local storage if needed
        try {
          // Example: Update localStorage cache
          const projectsCache = localStorage.getItem("projectsCache")
          if (projectsCache) {
            const cache = JSON.parse(projectsCache)
            if (cache[projectId]) {
              cache[projectId].audioUrl = updatedProject.audioUrl
              localStorage.setItem("projectsCache", JSON.stringify(cache))
              console.log("Updated project cache with new audio URL")
            }
          }
        } catch (e) {
          console.error("Error updating project cache:", e)
        }
      } else {
        console.warn("Updated project not found in response")
      }

      toast.success("Audio replaced with TTS successfully")
      await onModificationComplete()
      onClose()
    } catch (error) {
      console.error("Error replacing with TTS:", error)

      // Improved error handling with type checking
      if (error instanceof AxiosError) {
        console.error("Error response:", error.response?.data)
        toast.error(`Failed to replace audio with TTS: ${error.response?.status} ${error.response?.statusText}`)
      } else {
        toast.error("Failed to replace audio with TTS")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = async () => {
    if (modificationType === "mute") {
      await handleMuteAudio()
    } else {
      await handleReplaceWithTts()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">Start Time:</span>
          <span>{formatTime(startTime)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">End Time:</span>
          <span>{formatTime(endTime)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Duration:</span>
          <span>{formatTime(endTime - startTime)}</span>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Label>Modification Type</Label>
        <RadioGroup
          value={modificationType}
          onValueChange={(value) => setModificationType(value as "mute" | "tts")}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mute" id="mute" />
            <Label htmlFor="mute" className="flex items-center cursor-pointer">
              <VolumeX className="h-4 w-4 mr-2" />
              Mute Section
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tts" id="tts" />
            <Label htmlFor="tts" className="flex items-center cursor-pointer">
              <Mic className="h-4 w-4 mr-2" />
              Replace with TTS
            </Label>
          </div>
        </RadioGroup>
      </div>

      {modificationType === "tts" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="replacementText">Replacement Text</Label>
            <Textarea
              id="replacementText"
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              placeholder="Enter text to synthesize"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="useEdgeTts">Use Edge TTS (faster)</Label>
              <Switch id="useEdgeTts" checked={useEdgeTts} onCheckedChange={setUseEdgeTts} />
            </div>
            <p className="text-xs text-muted-foreground">
              Edge TTS is faster but has less natural voice. Tortoise TTS provides better voice cloning but is slower.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Voice Gender</Label>
            <RadioGroup
              value={gender}
              onValueChange={(value) => setGender(value as "male" | "female")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female">Female</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : modificationType === "mute" ? (
            <>
              <VolumeX className="mr-2 h-4 w-4" />
              Mute Section
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Replace with TTS
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
