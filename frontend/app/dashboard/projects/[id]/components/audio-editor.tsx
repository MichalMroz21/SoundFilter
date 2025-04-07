"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import type { AudioProject } from "@/models/user/UserResponse"
import type { TranscriptionResult, WordTimestamp } from "@/models/audio/TranscriptionResult"
import { formatTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface AudioEditorProps {
  project: AudioProject
  transcription: TranscriptionResult | null
  onTranscribe: () => Promise<void>
  isTranscribing: boolean
}

export default function AudioEditor({ project, transcription, onTranscribe, isTranscribing }: AudioEditorProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedWord, setSelectedWord] = useState<WordTimestamp | null>(null)
  const [isWordDialogOpen, setIsWordDialogOpen] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const wordTableRef = useRef<HTMLDivElement>(null)
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null)
  const isPlayingRef = useRef(false) // Use ref to track playing state to avoid race conditions

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
      setDuration(audio.duration)
      setIsLoading(false)
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

    const handleError = (e: ErrorEvent) => {
      console.error("Audio playback error:", e)
      setPlaybackError("Error playing audio. Please try again.")
      isPlayingRef.current = false
      setIsPlaying(false)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("error", handleError as EventListener)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("error", handleError as EventListener)
    }
  }, [])

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
            // Only set error if we're still trying to play
            if (isPlayingRef.current) {
              setPlaybackError("Failed to play audio. Please try again.")
              isPlayingRef.current = false
              setIsPlaying(false)
            }
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && <p className="text-muted-foreground">{project.description}</p>}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-6">
            <audio ref={audioRef} src={project.audioUrl} className="hidden" preload="metadata" />

            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{formatTime(currentTime)}</span>
                  <span className="text-sm font-medium">{formatTime(duration)}</span>
                </div>

                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />

                {playbackError && <div className="text-destructive text-sm py-1">{playbackError}</div>}

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

                    <Button variant="default" size="icon" onClick={togglePlayPause} className="h-10 w-10 rounded-full">
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
          <h2 className="text-2xl font-semibold">Transcription</h2>
          <Button onClick={onTranscribe} disabled={isTranscribing}>
            {isTranscribing ? "Transcribing..." : transcription ? "Retranscribe" : "Transcribe Audio"}
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

          <div className="py-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Start Time:</span>
                <span>{selectedWord ? formatTime(getStartTime(selectedWord)) : "--:--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">End Time:</span>
                <span>{selectedWord ? formatTime(getEndTime(selectedWord)) : "--:--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Duration:</span>
                <span>
                  {selectedWord
                    ? ((getEndTime(selectedWord) - getStartTime(selectedWord)) * 1000).toFixed(0) + " ms"
                    : "--"}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                Operations will be implemented in a future update. These operations will use the start and end times to
                apply effects to specific portions of the audio.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                if (selectedWord) seekToWordTime(selectedWord)
                setIsWordDialogOpen(false)
              }}
            >
              Play from this word
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

