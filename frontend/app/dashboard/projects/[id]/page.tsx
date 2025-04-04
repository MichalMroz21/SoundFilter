"use client"

import { useAuthGuard } from "@/lib/auth/use-auth"
import { useParams, useRouter } from "next/navigation"
import Container from "@/components/container"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Loading from "@/components/loading"
import { useState, useEffect } from "react"

export default function ProjectEditPage() {
  const { user } = useAuthGuard({ middleware: "auth" })
  const params = useParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    if (user) {
      const projectIndex = Number.parseInt(params.id as string)
      const foundProject = user.audioProjects?.[projectIndex]
      setProject(foundProject)
      setIsLoading(false)
    }
  }, [user, params.id])

  if (isLoading || !user) {
    return <Loading />
  }

  if (!project) {
    return (
      <Container size="lg" className="py-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </Container>
    )
  }

  return (
    <Container size="lg" className="py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.description || "No description provided"}</p>
          </div>
        </div>

        <div className="border rounded-lg p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Project Editor</h2>
            <p className="text-muted-foreground">This is a placeholder for the project editor interface.</p>
          </div>
        </div>
      </div>
    </Container>
  )
}

