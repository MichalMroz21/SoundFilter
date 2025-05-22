"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Settings, Mic, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import type { AudioProject } from "@/models/user/UserResponse"
import type { TranscriptionResult, WordTimestamp } from "@/models/audio/TranscriptionResult"
import { formatTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import httpClient from "@/lib/httpClient"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

// Update the AudioEditorProps interface to include the onProjectUpdate function
interface AudioEditorProps {
  project: AudioProject
  transcription: TranscriptionResult | null
  onTranscribe: () => Promise<void>
  isTranscribing: boolean
  onProjectUpdate?: () => Promise<void>
}

// Update the function signature to include the new prop
export default function AudioEditor({
  project,
  transcription,
  onTranscribe,
  isTranscribing,
  onProjectUpdate,
}: AudioEditorProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedWord, setSelectedWord] = useState<WordTimestamp | null>(null)
  const [isWordDialogOpen, setIsWordDialogOpen] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [isModifying, setIsModifying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const wordTableRef = useRef<HTMLDivElement>(null)
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null)
  const isPlayingRef = useRef(false) // Use ref to track playing state to avoid race conditions
  const [audioKey, setAudioKey] = useState(Date.now()) // Key to force audio element refresh

  // Helper function to get the start time from a word, handling different property names
  const getStartTime = (word: WordTimestamp): number => {
    if (word.startTime !== undefined) return Number(word.startTime)
    if (word.start_time !== undefined) return Number(word.start_time)
    return 0
  }

  // Helper function to get the end time from a word, handling different property names
  const getEndTime = (word: WordTimestamp): number => {
    if (word.endTime !== undefined) return Number(word.endTime)
    if (word.end_time !== undefined) return Number(word.end_time)
    return 0
  }

  // Update the getAudioUrl function to remove the cache-busting parameter
  const getAudioUrl = useCallback(() => {
    // Return the raw URL without any cache busting
    return project.audioUrl || ""
  }, [project.audioUrl])

  // Reset audio when project changes or audioKey changes
  useEffect(() => {
    console.log("Audio URL changed:", getAudioUrl())
    setCurrentTime(0)
    setIsPlaying(false)
    isPlayingRef.current = false
    setIsLoading(true)
    setPlaybackError(null)
  }, [project.id, project.audioUrl, audioKey])

  // Find the current word index based on playback time
  useEffect(() => {
    if (!transcription?.words) return

    // Find the index of the current word based on time
    const index = transcription.words.findIndex((word) => {
      const startTime = getStartTime(word)
      const endTime = getEndTime(word)
      return currentTime >= startTime && currentTime <= endTime
    })

    setCurrentWordIndex(index >= 0 ? index : null)
  }, [currentTime, transcription])

  // Handle auto-scrolling in the word table without affecting page scroll
  useEffect(() => {
    if (currentWordIndex === null || !wordTableRef.current || !transcription?.words) return

    // Get all rows in the table
    const rows = wordTableRef.current.querySelectorAll("tbody tr")
    if (!rows.length || currentWordIndex >= rows.length) return

    // Get the current row
    const currentRow = rows[currentWordIndex] as HTMLElement
    if (!currentRow) return

    // Calculate position for scrolling
    const tableContainer = wordTableRef.current
    const rowTop = currentRow.offsetTop
    const rowHeight = currentRow.offsetHeight
    const containerHeight = tableContainer.clientHeight
    const scrollTop = tableContainer.scrollTop

    // Only scroll if the row is not fully visible
    if (rowTop < scrollTop || rowTop + rowHeight > scrollTop + containerHeight) {
      // Calculate the new scroll position to center the row (or keep it in view)
      const newScrollTop = rowTop - containerHeight / 2 + rowHeight / 2

      // Use scrollTo with behavior: "smooth" for a nice animation
      tableContainer.scrollTo({
        top: newScrollTop,
        behavior: "smooth",
      })
    }
  }, [currentWordIndex])

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      console.log("Audio metadata loaded, duration:", audio.duration)
      setDuration(audio.duration)
      setIsLoading(false)
      setPlaybackError(null)
    }

    const handleCanPlay = () => {
      console.log("Audio can play")
      setIsLoading(false)
      setPlaybackError(null)
    }

    const handleEnded = () => {
      isPlayingRef.current = false
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }

    const handlePlay = () => {
      isPlayingRef.current = true
      setIsPlaying(true)
      setPlaybackError(null)
    }

    const handlePause = () => {
      isPlayingRef.current = false
      setIsPlaying(false)
    }

    const handleError = (e: Event) => {
      console.error("Audio error:", e)
      const audioElement = e.target as HTMLAudioElement
      if (audioElement.error) {
        console.error("Audio error details:", audioElement.error)
        setPlaybackError(`Error loading audio: ${audioElement.error.message}`)
      } else {
        setPlaybackError("Error loading audio. Please try again.")
      }
      isPlayingRef.current = false
      setIsPlaying(false)
      setIsLoading(false)
    }

    const handleLoadStart = () => {
      console.log("Audio load started")
      setIsLoading(true)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("error", handleError)
    audio.addEventListener("loadstart", handleLoadStart)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("error", handleError)
      audio.removeEventListener("loadstart", handleLoadStart)
    }
  }, [audioKey]) // Reattach listeners when audio key changes

  // Scroll to the current word in the transcript
  useEffect(() => {
    if (!transcription?.words || !transcriptRef.current || currentWordIndex === null) return

    // Find the current word element
    const wordElements = transcriptRef.current.querySelectorAll("span.cursor-pointer")
    if (currentWordIndex >= 0 && currentWordIndex < wordElements.length) {
      const currentWordElement = wordElements[currentWordIndex] as HTMLElement

      // Calculate position for scrolling
      const containerTop = transcriptRef.current.scrollTop
      const containerHeight = transcriptRef.current.clientHeight
      const elementTop = currentWordElement.offsetTop
      const elementHeight = currentWordElement.offsetHeight

      // Only scroll if the element is not fully visible
      if (elementTop < containerTop || elementTop + elementHeight > containerTop + containerHeight) {
        // Scroll the container directly instead of using scrollIntoView
        transcriptRef.current.scrollTop = elementTop - containerHeight / 2 + elementHeight / 2
      }
    }
  }, [currentWordIndex, transcription])

  // Memoize toggle play/pause to avoid recreating the function on each render
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    setPlaybackError(null)

    if (isPlayingRef.current) {
      // Currently playing, so pause
      audio.pause()
    } else {
      // Currently paused, so play
      try {
        const playPromise = audio.play()

        // Modern browsers return a promise from play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Play error:", error)
            setPlaybackError("Failed to play audio. Please try again.")
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Play error:", error)
        setPlaybackError("Failed to play audio. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const wasPlaying = isPlayingRef.current

    // Pause before seeking to avoid race conditions
    if (wasPlaying) {
      audio.pause()
    }

    audio.currentTime = value[0]
    setCurrentTime(value[0])

    // Resume playback if it was playing before
    if (wasPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Play error after seek:", error)
            setPlaybackError("Failed to resume after seeking. Please try again.")
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Play error after seek:", error)
        setPlaybackError("Failed to resume after seeking. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [])

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const audio = audioRef.current
      if (!audio) return

      const newVolume = value[0]
      setVolume(newVolume)
      audio.volume = newVolume

      if (newVolume === 0) {
        setIsMuted(true)
      } else if (isMuted) {
        setIsMuted(false)
      }
    },
    [isMuted],
  )

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const skipBackward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const wasPlaying = isPlayingRef.current

    // Pause before seeking to avoid race conditions
    if (wasPlaying) {
      audio.pause()
    }

    audio.currentTime = Math.max(0, audio.currentTime - 10)
    setCurrentTime(audio.currentTime)

    // Resume playback if it was playing before
    if (wasPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Play error after skip backward:", error)
            setPlaybackError("Failed to resume after skipping. Please try again.")
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Play error after skip backward:", error)
        setPlaybackError("Failed to resume after skipping. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const wasPlaying = isPlayingRef.current

    // Pause before seeking to avoid race conditions
    if (wasPlaying) {
      audio.pause()
    }

    audio.currentTime = Math.min(duration, audio.currentTime + 10)
    setCurrentTime(audio.currentTime)

    // Resume playback if it was playing before
    if (wasPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Play error after skip forward:", error)
            setPlaybackError("Failed to resume after skipping. Please try again.")
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Play error after skip forward:", error)
        setPlaybackError("Failed to resume after skipping. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [duration])

  const seekToWordTime = useCallback((word: WordTimestamp) => {
    const audio = audioRef.current
    if (!audio) return

    const wasPlaying = isPlayingRef.current
    const startTime = getStartTime(word)

    // Pause before seeking to avoid race conditions
    if (wasPlaying) {
      audio.pause()
    }

    audio.currentTime = startTime
    setCurrentTime(startTime)

    // Resume playback if it was playing before
    if (wasPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Play error after seek to word:", error)
            setPlaybackError("Failed to resume after seeking to word. Please try again.")
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Play error after seek to word:", error)
        setPlaybackError("Failed to resume after seeking to word. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [])

  const handleWordClick = useCallback((word: WordTimestamp) => {
    setSelectedWord(word)
    setIsWordDialogOpen(true)
  }, [])

  // Function to render the transcript with highlighted words based on timestamps
  const renderHighlightedTranscript = () => {
    if (!transcription || !transcription.words || transcription.words.length === 0) {
      return <p>{transcription?.transcript || ""}</p>
    }

    return (
      <div className="relative whitespace-pre-wrap" ref={transcriptRef}>
        {transcription.words.map((word, index) => {
          const isCurrentWord = index === currentWordIndex

          return (
            <span
              key={index}
              className={`cursor-pointer transition-colors relative ${isCurrentWord ? "current-word" : ""}`}
              onClick={() => seekToWordTime(word)}
            >
              {isCurrentWord && (
                <span className="absolute inset-0 bg-yellow-300 dark:bg-yellow-700 opacity-70 rounded-sm -mx-0.5 -my-0.5 px-0.5 py-0.5"></span>
              )}
              <span className={`relative z-10 ${isCurrentWord ? "font-medium" : ""}`}>{word.word}</span>
            </span>
          )
        })}
      </div>
    )
  }

  // Reset audio on component unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }
  }, [])

  // Update the handleModificationComplete function to properly handle the new audio URL
  const handleModificationComplete = async (newAudioUrl?: string) => {
    // If a new audio URL is provided, update the project's audio URL
    if (newAudioUrl) {
      console.log("Updating audio URL from:", project.audioUrl, "to:", newAudioUrl)

      // Update the project object with the new URL
      project.audioUrl = newAudioUrl

      // Force a re-render by updating the audio key
      setAudioKey(Date.now())

      // Log the updated project to verify
      console.log("Project after update:", project)

      // Add a small delay to ensure the browser has time to release the old audio resource
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Force the audio element to reload with the new URL
      if (audioRef.current) {
        audioRef.current.load()
      }

      // Call the parent's onProjectUpdate if available to ensure the URL is saved
      if (onProjectUpdate) {
        await onProjectUpdate()
      }
    }

    // Reset playback state
    setCurrentTime(0)
    setIsPlaying(false)
    isPlayingRef.current = false

    // Reload transcription if needed
    if (onTranscribe) {
      await onTranscribe()
    }
  }

  // Add a debug button to force refresh the audio
  const forceRefreshAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    console.log("Force refreshing audio with current URL:", project.audioUrl)
    setAudioKey(Date.now())
    setCurrentTime(0)
    setIsPlaying(false)
    isPlayingRef.current = false

    // Force a reload of the audio element
    if (audioRef.current) {
      audioRef.current.load()
    }
  }, [project.audioUrl])

  // Remove this useEffect that's causing the infinite loop

  // Add this to the UI, right after the transcribe button
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && <p className="text-muted-foreground">{project.description}</p>}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-6">
            <audio
              ref={audioRef}
              src={getAudioUrl()}
              className="hidden"
              preload="metadata"
              key={audioKey}
              crossOrigin="anonymous"
            />

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <p className="text-sm text-muted-foreground text-center">Loading audio...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{formatTime(currentTime)}</span>
                  <span className="text-sm font-medium">{formatTime(duration)}</span>
                </div>

                <Slider
                  value={[currentTime]}
                  max={duration || 1}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                  disabled={duration === 0}
                />

                {playbackError && (
                  <div className="text-destructive text-sm py-1 bg-destructive/10 px-3 rounded">
                    {playbackError}
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-2 h-auto p-0 text-destructive"
                      onClick={() => setAudioKey(Date.now())}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="hover:bg-primary/10">
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={1}
                      step={0.01}
                      onValueChange={handleVolumeChange}
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" onClick={skipBackward} className="hover:bg-primary/10">
                      <SkipBack className="h-5 w-5" />
                    </Button>

                    <Button
                      variant="default"
                      size="icon"
                      onClick={togglePlayPause}
                      className="h-10 w-10 rounded-full"
                      disabled={duration === 0}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </Button>

                    <Button variant="ghost" size="icon" onClick={skipForward} className="hover:bg-primary/10">
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="w-28" /> {/* Spacer to balance the layout */}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Button onClick={onTranscribe} disabled={isTranscribing || isModifying}>
            {isTranscribing ? "Transcribing..." : transcription ? "Retranscribe" : "Transcribe Audio"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              console.log("Force refreshing audio with current URL:", project.audioUrl)
              setAudioKey(Date.now())
            }}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            🔄 Refresh Audio
          </Button>
        </div>

        {transcription ? (
          <div className="bg-muted p-4 rounded-md min-h-[150px] max-h-[250px] overflow-y-auto">
            {renderHighlightedTranscript()}
          </div>
        ) : (
          <div className="bg-muted/50 border rounded-md p-8 text-center">
            <p className="text-muted-foreground">
              {isTranscribing
                ? "Transcribing your audio file..."
                : "Click the transcribe button to generate a text transcript of your audio file."}
            </p>
          </div>
        )}
      </div>

      {/* Word-by-word list */}
      {transcription && transcription.words && transcription.words.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Word-by-Word Breakdown</h2>
          <div className="bg-muted rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto relative" ref={wordTableRef}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium bg-muted border-b">Word</th>
                    <th className="text-left py-2 px-3 font-medium bg-muted border-b">Start Time</th>
                    <th className="text-left py-2 px-3 font-medium bg-muted border-b">End Time</th>
                    <th className="text-right py-2 px-3 font-medium bg-muted border-b">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transcription.words.map((word, index) => {
                    const isCurrentWord = index === currentWordIndex

                    return (
                      <tr
                        key={index}
                        className={`hover:bg-muted-foreground/10 ${isCurrentWord ? "bg-muted-foreground/5" : ""}`}
                      >
                        <td className="py-2 px-3">{word.word}</td>
                        <td className="py-2 px-3">{formatTime(getStartTime(word))}</td>
                        <td className="py-2 px-3">{formatTime(getEndTime(word))}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => seekToWordTime(word)}>
                              <Play className="h-3 w-3 mr-1" />
                              <span className="text-xs">Play</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleWordClick(word)}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              <span className="text-xs">Options</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Word operations dialog */}
      <Dialog open={isWordDialogOpen} onOpenChange={setIsWordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Word Operations</DialogTitle>
            <DialogDescription>Apply operations to the selected word: "{selectedWord?.word}"</DialogDescription>
          </DialogHeader>

          {selectedWord && (
            <AudioModificationOptions
              projectId={project.id}
              selectedWord={selectedWord}
              onModificationComplete={handleModificationComplete}
              onClose={() => setIsWordDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Update the AudioModificationOptionsProps interface to accept the new audio URL
interface AudioModificationOptionsProps {
  projectId: number
  selectedWord: WordTimestamp
  onModificationComplete: (newAudioUrl?: string) => Promise<void>
  onClose: () => void
}

// Replace the entire AudioModificationOptions component with this fixed version
const AudioModificationOptions: React.FC<AudioModificationOptionsProps> = ({
  projectId,
  selectedWord,
  onModificationComplete,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationType, setModificationType] = useState<"mute" | "tts">("mute")
  const [replacementText, setReplacementText] = useState(selectedWord.word)
  const [useEdgeTts, setUseEdgeTts] = useState(true)
  const [gender, setGender] = useState<"male" | "female">("male")

  // Helper function to get the start time from a word, handling different property names
  const getStartTime = (word: WordTimestamp): number => {
    if (word.startTime !== undefined) return Number(word.startTime)
    if (word.start_time !== undefined) return Number(word.start_time)
    return 0
  }

  // Helper function to get the end time from a word, handling different property names
  const getEndTime = (word: WordTimestamp): number => {
    if (word.endTime !== undefined) return Number(word.endTime)
    if (word.end_time !== undefined) return Number(word.end_time)
    return 0
  }

  const startTime = getStartTime(selectedWord)
  const endTime = getEndTime(selectedWord)

  // Simplified handleMuteAudio function to use the new response format
  const handleMuteAudio = async () => {
    setIsProcessing(true)
    try {
      console.log("Sending mute request with:", {
        projectId,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
      })

      const response = await httpClient.post(`/api/audio/${projectId}/mute-audio`, null, {
        params: {
          start_time: startTime,
          end_time: endTime,
        },
      })

      console.log("Mute response received:", response.data)

      // The response now directly contains the audioUrl
      const newAudioUrl = response.data.audioUrl

      if (newAudioUrl) {
        console.log("New audio URL:", newAudioUrl)

        // Pass the new audio URL to the parent component
        await onModificationComplete(newAudioUrl)
        toast.success("Audio section muted successfully")
        onClose()
      } else {
        console.error("No audio URL in response")
        toast.error("Failed to update audio. Please refresh the page.")
        setIsProcessing(false)
      }
    } catch (error) {
      console.error("Error muting audio:", error)
      toast.error("Failed to mute audio section")
      setIsProcessing(false)
    }
  }

  // Simplified handleReplaceWithTts function to use the new response format
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

      const response = await httpClient.post(`/api/audio/${projectId}/replace-with-tts`, null, {
        params: {
          start_time: startTime,
          end_time: endTime,
          replacement_text: replacementText,
          use_edge_tts: useEdgeTts,
          gender: gender,
        },
      })

      console.log("TTS response received:", response.data)

      // The response now directly contains the audioUrl
      const newAudioUrl = response.data.audioUrl

      if (newAudioUrl) {
        console.log("New audio URL:", newAudioUrl)

        // Pass the new audio URL to the parent component
        await onModificationComplete(newAudioUrl)
        toast.success("Audio replaced with TTS successfully")
        onClose()
      } else {
        console.error("No audio URL in response")
        toast.error("Failed to update audio. Please refresh the page.")
        setIsProcessing(false)
      }
    } catch (error) {
      console.error("Error replacing with TTS:", error)
      toast.error("Failed to replace audio with TTS")
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
          <span>{((endTime - startTime) * 1000).toFixed(0) + " ms"}</span>
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
