"use client"

import { useAuthGuard } from "@/lib/auth/use-auth"
import { useRouter } from "next/navigation"
import Container from "@/components/container"
import { useState, useEffect, useCallback } from "react"
import { AudioProjectCard } from "./components/audio-project-card"
import { AddProjectCard } from "./components/add-project-card"
import { UploadAudioModal } from "./components/upload-audio-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Loading from "@/components/loading"
import httpClient from "@/lib/httpClient"

export default function DashboardPage() {
  const { user, mutate } = useAuthGuard({ middleware: "auth" })
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(Date.now())

  // Function to fetch user data directly (bypassing SWR cache)
  const refreshUserData = useCallback(async () => {
    try {
      const response = await httpClient.get("/api/auth/me", {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      // Force update the SWR cache with the new data
      await mutate(response.data, false)

      // Update refresh key to trigger re-render
      setRefreshKey(Date.now())

      // Update the local state immediately
      if (response.data) {
        setIsLoading(false)
      }

      return response.data
    } catch (error) {
      console.error("Error refreshing user data:", error)
      return null
    }
  }, [mutate])

  // Use useEffect to handle any navigation or state changes
  useEffect(() => {
    if (user) {
      setIsLoading(false)
    }

    // Check if we have a refresh parameter in the URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.has("refresh")) {
        // Force a direct refresh of user data
        refreshUserData()
      }
    }
  }, [user, refreshUserData])

  // Set up a periodic revalidation
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUserData()
    }, 30000) // Revalidate every 30 seconds

    return () => clearInterval(interval)
  }, [refreshUserData])

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
                    key={`${project.id}-${project.updatedAt}-${refreshKey}`}
                    project={project}
                    projectIndex={index}
                    onProjectChange={refreshUserData}
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
                    key={`${project.id}-${project.updatedAt}-${refreshKey}`}
                    project={project}
                    projectIndex={index}
                    onProjectChange={refreshUserData}
                  />
                ))}
              <AddProjectCard onClick={() => setIsUploadModalOpen(true)} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <UploadAudioModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onProjectCreated={refreshUserData}
      />
    </Container>
  )
}

