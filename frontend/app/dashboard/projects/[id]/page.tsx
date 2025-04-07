"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthGuard } from "@/lib/auth/use-auth"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Loading from "@/components/loading"
import AudioEditor from "./components/audio-editor"
import type { AudioProject } from "@/models/user/UserResponse"
import type { TranscriptionResult } from "@/models/audio/TranscriptionResult"
import httpClient from "@/lib/httpClient"
import { toast } from "sonner"

export default function ProjectEditPage() {
  const { user } = useAuthGuard({ middleware: "auth" })
  const params = useParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [project, setProject] = useState<AudioProject | null>(null)
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)

  useEffect(() => {
    if (user) {
      const projectId = params.id as string
      const foundProject = user.audioProjects?.find((p) => p.id.toString() === projectId)
      setProject(foundProject || null)
      setIsLoading(false)
    }
  }, [user, params.id])

  const handleTranscribe = async () => {
    if (!project) return

    setIsTranscribing(true)
    try {
      const response = await httpClient.post<TranscriptionResult>(`/api/audio/${project.id}/transcribe`)
      setTranscription(response.data)
    } catch (error) {
      console.error("Error transcribing audio:", error)
      toast.error("Failed to transcribe audio")
    } finally {
      setIsTranscribing(false)
    }
  }

  if (isLoading || !user) {
    return <Loading />
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Project Not Found</h1>
          <p className="text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-10 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background/90 rounded-full h-10 w-10 p-0"
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="sr-only">Back to dashboard</span>
      </Button>

      <div className="flex-1 container max-w-5xl mx-auto py-12 px-4">
        <AudioEditor
          project={project}
          transcription={transcription}
          onTranscribe={handleTranscribe}
          isTranscribing={isTranscribing}
        />
      </div>
    </div>
  )
}

