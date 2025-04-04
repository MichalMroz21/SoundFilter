"use client"

import { useAuthGuard } from "@/lib/auth/use-auth"
import { useRouter } from "next/navigation"
import Container from "@/components/container"
import { useState, useEffect } from "react"
import { AudioProjectCard } from "./components/audio-project-card"
import { AddProjectCard } from "./components/add-project-card"
import { UploadAudioModal } from "./components/upload-audio-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Loading from "@/components/loading"

export default function DashboardPage() {
  const { user } = useAuthGuard({ middleware: "auth" })
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      setIsLoading(false)
    }
  }, [user])

  if (isLoading || !user) {
    return <Loading />
  }

  const audioProjects = user.audioProjects || []

  return (
    <Container size="lg" className="py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Your Audio Projects</h1>
          <p className="text-muted-foreground">Manage your audio files, transcriptions, and filters</p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {audioProjects.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AddProjectCard onClick={() => setIsUploadModalOpen(true)} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {audioProjects.map((project, index) => (
                  <AudioProjectCard
                    key={index}
                    project={project}
                    onClick={() => router.push(`/dashboard/projects/${index}`)}
                  />
                ))}
                <AddProjectCard onClick={() => setIsUploadModalOpen(true)} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {audioProjects
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 3)
                .map((project, index) => (
                  <AudioProjectCard
                    key={index}
                    project={project}
                    onClick={() => router.push(`/dashboard/projects/${index}`)}
                  />
                ))}
              <AddProjectCard onClick={() => setIsUploadModalOpen(true)} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <UploadAudioModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
    </Container>
  )
}

