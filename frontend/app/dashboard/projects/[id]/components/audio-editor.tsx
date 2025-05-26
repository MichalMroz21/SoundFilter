"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  VolumeX,
  Mic,
  Loader2,
  FileType,
  Music,
  Eye,
  EyeOff,
  SkipBack,
  Play,
  SkipForward,
  Download,
  Settings,
  Volume2,
  Pause,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { AudioProject } from "@/models/user/UserResponse"
import type { TranscriptionResult, WordTimestamp } from "@/models/audio/TranscriptionResult"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import httpClient from "@/lib/httpClient"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Define MediaError if not available
const MediaError = {
  MEDIA_ERR_ABORTED: 1,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
}

// Update the AudioEditorProps interface to include the onProjectUpdate function
interface AudioEditorProps {
  project: AudioProject
  transcription: TranscriptionResult | null
  onTranscribe: () => Promise<void>
  isTranscribing: boolean
  onProjectUpdate?: () => Promise<void>
}

// Add this new function near the top of the component
const formatTimeWithMilliseconds = (seconds: number): string => {
  const totalMs = Math.floor(seconds * 1000)
  const ms = totalMs % 1000
  const totalSeconds = Math.floor(totalMs / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(3, "0")}`
}

// Update the function signature to include the new prop
export default function AudioEditor({
  project,
  transcription,
  onTranscribe,
  isTranscribing,
  onProjectUpdate,
}: AudioEditorProps) {
  // Add these new state variables near the top of the component where other state is defined
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
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(true)
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [targetFormat, setTargetFormat] = useState("")
  const [isAudioBroken, setIsAudioBroken] = useState(false)
  const [isAnalyzingDuration, setIsAnalyzingDuration] = useState(false)
  const [durationDetectionFailed, setDurationDetectionFailed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hasDraggedDistance, setHasDraggedDistance] = useState(false)
  const [justFinishedDragging, setJustFinishedDragging] = useState(false)
  const [isSelectionModifyDialogOpen, setIsSelectionModifyDialogOpen] = useState(false)

  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [startTimeInput, setStartTimeInput] = useState("")
  const [endTimeInput, setEndTimeInput] = useState("")
  const [dragStart, setDragStart] = useState<number | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ wordIndex: number; word: WordTimestamp }[]>([])
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [exactMatch, setExactMatch] = useState(false)

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

  // Helper function to get format-specific seek buffer
  const getSeekBuffer = useCallback(() => {
    const format = project.extension?.toLowerCase()
    switch (format) {
      case "flac":
        return 0.5 // FLAC needs more buffer due to compression
      case "m4a":
      case "aac":
        return 0.3 // AAC formats need buffer
      case "mp3":
        return 0.2 // MP3 is more forgiving
      case "wav":
        return 0.1 // WAV is uncompressed, minimal buffer needed
      default:
        return 0.3 // Safe default for unknown formats
    }
  }, [project.extension])

  // Update the getAudioUrl function to remove the cache-busting parameter
  const getAudioUrl = useCallback(() => {
    // Return the raw URL without any cache busting
    return project.audioUrl || ""
  }, [project.audioUrl])

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const wordTableRef = useRef<HTMLDivElement>(null)
  const isPlayingRef = useRef(false) // Use ref to track playing state to avoid race conditions
  const previousTimeRef = useRef(0)
  const jumpDetectedRef = useRef(false)
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stallTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // State for word navigation
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null)
  const [manualWordSelection, setManualWordSelection] = useState(false)

  // Audio element key for forcing refresh
  const [audioKey, setAudioKey] = useState(Date.now())

  const WaveformVisualization: React.FC<{
    currentTime: number
    duration: number
    onSeek: (time: number) => void
    isLoading: boolean
    selection: { start: number; end: number } | null
    onSelectionChange: (selection: { start: number; end: number } | null) => void
    startTimeInput: string
    endTimeInput: string
    onStartTimeInputChange: (value: string) => void
    onEndTimeInputChange: (value: string) => void
  }> = ({
    currentTime,
    duration,
    onSeek,
    isLoading,
    selection,
    onSelectionChange,
    startTimeInput,
    endTimeInput,
    onStartTimeInputChange,
    onEndTimeInputChange,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [canvasWidth, setCanvasWidth] = useState(800)
    const [isHovering, setIsHovering] = useState(false)
    const [hoverTime, setHoverTime] = useState(0)
    const [zoomLevel, setZoomLevel] = useState(1)
    const [scrollPosition, setScrollPosition] = useState(0)

    // Simplified selection state
    const [isDraggingLocal, setIsDraggingLocal] = useState(false)
    const [dragStartTime, setDragStartTime] = useState<number | null>(null)
    const [dragEndTime, setDragEndTime] = useState<number | null>(null)

    // Use useMemo to cache waveform data and prevent regeneration
    const waveformData = useMemo(() => {
      const audioUrl = project.audioUrl
      if (!audioUrl) {
        console.log("No audio URL available for waveform")
        return []
      }

      // Create a stable cache key
      const cacheKey = `waveform_${audioUrl}`

      // Check if we have cached data in sessionStorage (survives hot reloads)
      const cachedData = sessionStorage.getItem(cacheKey)
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData)
          console.log("Using cached waveform data")
          return parsed
        } catch (e) {
          console.warn("Failed to parse cached waveform data")
        }
      }

      console.log("Generating new waveform for:", audioUrl)

      // Generate waveform data
      const generateWaveform = async () => {
        try {
          // Create audio context
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext
          if (!AudioContext) {
            throw new Error("Web Audio API not supported")
          }

          const audioContext = new AudioContext()
          const response = await fetch(audioUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

          // Get the raw audio data
          const rawData = audioBuffer.getChannelData(0)
          const samples = rawData.length
          const blockSize = Math.floor(samples / 4000)
          const filteredData: number[] = []

          // Process audio in blocks
          for (let i = 0; i < 4000; i++) {
            const blockStart = blockSize * i
            let sum = 0
            let max = 0

            for (let j = 0; j < blockSize; j++) {
              const sample = Math.abs(rawData[blockStart + j] || 0)
              sum += sample * sample
              max = Math.max(max, sample)
            }

            const rms = Math.sqrt(sum / blockSize)
            const amplitude = rms * 0.7 + max * 0.3
            filteredData.push(amplitude)
          }

          // Close audio context
          if (audioContext.state !== "closed") {
            await audioContext.close()
          }

          // Cache the data in sessionStorage
          sessionStorage.setItem(cacheKey, JSON.stringify(filteredData))
          console.log(`Generated and cached waveform with ${filteredData.length} data points`)

          return filteredData
        } catch (error) {
          console.error("Error generating waveform:", error)

          // Generate fallback fake waveform
          const fakeData: number[] = []
          for (let i = 0; i < 4000; i++) {
            let value = 0
            if (i % 200 < 150) {
              const base = Math.sin(i * 0.003) * 0.3
              const harmonic1 = Math.sin(i * 0.015) * 0.2
              const noise = (Math.random() * 2 - 1) * 0.1
              value = Math.abs(base + harmonic1 + noise)
              if (i % 80 === 0) value *= 2
            }
            fakeData.push(Math.max(0, Math.min(1, value)))
          }

          // Cache the fallback data too
          sessionStorage.setItem(cacheKey, JSON.stringify(fakeData))
          return fakeData
        }
      }

      // For synchronous return, return empty array and trigger async generation
      generateWaveform().then(() => {
        // Force a re-render after async generation completes
        // This is a bit of a hack but necessary for the useMemo pattern
        window.dispatchEvent(new CustomEvent("waveformGenerated"))
      })

      return [] // Return empty array initially
    }, [project.audioUrl]) // Only depend on audioUrl

    // Listen for waveform generation completion
    const [, forceUpdate] = useState({})
    useEffect(() => {
      const handleWaveformGenerated = () => {
        forceUpdate({}) // Force re-render
      }
      window.addEventListener("waveformGenerated", handleWaveformGenerated)
      return () => window.removeEventListener("waveformGenerated", handleWaveformGenerated)
    }, [])

    // Get actual waveform data (either from useMemo or sessionStorage)
    const actualWaveformData = useMemo(() => {
      if (waveformData.length > 0) {
        return waveformData
      }

      // Try to get from sessionStorage if useMemo returned empty
      const audioUrl = project.audioUrl
      if (audioUrl) {
        const cacheKey = `waveform_${audioUrl}`
        const cachedData = sessionStorage.getItem(cacheKey)
        if (cachedData) {
          try {
            return JSON.parse(cachedData)
          } catch (e) {
            return []
          }
        }
      }
      return []
    }, [waveformData, project.audioUrl])

    // Update canvas width on resize
    useEffect(() => {
      const updateCanvasWidth = () => {
        if (containerRef.current) {
          const width = containerRef.current.clientWidth
          setCanvasWidth(width)
        }
      }

      updateCanvasWidth()
      window.addEventListener("resize", updateCanvasWidth)
      return () => window.removeEventListener("resize", updateCanvasWidth)
    }, [])

    // Auto-scroll to keep current time in view when zoomed
    useEffect(() => {
      if (duration > 0 && zoomLevel > 1) {
        const timeProgress = currentTime / duration
        const visibleRange = 1 / zoomLevel

        if (timeProgress < scrollPosition || timeProgress > scrollPosition + visibleRange) {
          const newScrollPosition = Math.max(0, Math.min(1 - visibleRange, timeProgress - visibleRange / 2))
          setScrollPosition(newScrollPosition)
        }
      }
    }, [currentTime, duration, zoomLevel, scrollPosition])

    // Handle mouse wheel zoom
    const handleWheel = useCallback(
      (e: WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const zoomFactor = 1.2
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        const mouseX = e.clientX - rect.left
        const mouseProgress = mouseX / rect.width

        if (e.deltaY < 0) {
          setZoomLevel((prev) => {
            const newZoom = Math.min(prev * zoomFactor, 100)
            if (newZoom > 1) {
              const visibleRange = 1 / newZoom
              const currentVisibleRange = 1 / prev
              const mouseTimeInVisible = scrollPosition + mouseProgress * currentVisibleRange
              const newScrollPos = Math.max(
                0,
                Math.min(1 - visibleRange, mouseTimeInVisible - mouseProgress * visibleRange),
              )
              setScrollPosition(newScrollPos)
            }
            return newZoom
          })
        } else {
          setZoomLevel((prev) => {
            const newZoom = Math.max(prev / zoomFactor, 1)
            if (newZoom === 1) {
              setScrollPosition(0)
            }
            return newZoom
          })
        }
      },
      [scrollPosition],
    )

    // Add wheel event listener
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.addEventListener("wheel", handleWheel, { passive: false })
      return () => canvas.removeEventListener("wheel", handleWheel)
    }, [handleWheel])

    // Helper function to convert mouse position to time
    const getTimeFromMousePosition = useCallback(
      (e: MouseEvent | React.MouseEvent) => {
        if (!duration || !canvasRef.current) return 0

        const rect = canvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const relativeX = Math.max(0, Math.min(1, x / rect.width))
        const visibleRange = 1 / zoomLevel
        const timeInVisibleRange = scrollPosition + relativeX * visibleRange
        // Allow seeking to the full duration without buffer restriction
        const finalTime = Math.max(0, Math.min(duration, timeInVisibleRange * duration))

        console.log("🕐 TIME FROM MOUSE:", {
          clientX: e.clientX,
          rectLeft: rect.left,
          x,
          rectWidth: rect.width,
          relativeX,
          visibleRange,
          scrollPosition,
          timeInVisibleRange,
          finalTime,
          duration,
        })

        return finalTime
      },
      [duration, zoomLevel, scrollPosition],
    )

    // Draw waveform
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + "px"
      canvas.style.height = rect.height + "px"

      ctx.scale(dpr, dpr)

      const width = rect.width
      const height = rect.height

      // Clear canvas
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, width, height)

      // Calculate visible range
      const visibleRange = 1 / zoomLevel
      const startTime = scrollPosition
      const endTime = Math.min(1, scrollPosition + visibleRange)

      // Draw grid
      ctx.strokeStyle = "#1a1a1a"
      ctx.lineWidth = 0.5

      const verticalLines = Math.min(40, Math.max(8, 12 * Math.sqrt(zoomLevel)))
      for (let i = 1; i < verticalLines; i++) {
        const x = (width / verticalLines) * i
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      const horizontalLines = 6
      for (let i = 1; i < horizontalLines; i++) {
        const y = (height / horizontalLines) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Center line
      ctx.strokeStyle = "#2a2a2a"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      // Draw waveform using the actual data
      if (actualWaveformData.length > 0) {
        const startIndex = Math.floor(startTime * actualWaveformData.length)
        const endIndex = Math.floor(endTime * actualWaveformData.length)
        const visibleData = actualWaveformData.slice(startIndex, endIndex)

        if (visibleData.length > 0) {
          const centerY = height / 2
          const padding = 20 // Reduced from 80 to 20
          const safeHeight = height - 2 * padding
          const maxValue = Math.max(...visibleData.map(Math.abs))
          const amplitudeScale = maxValue > 0 ? (safeHeight * 0.3) / maxValue : 0

          const gradient = ctx.createLinearGradient(0, 0, 0, height)
          gradient.addColorStop(0, "#7dd3fc")
          gradient.addColorStop(0.5, "#0ea5e9")
          gradient.addColorStop(1, "#7dd3fc")

          ctx.save()
          ctx.beginPath()
          ctx.rect(0, padding, width, height - 2 * padding) // Removed the +10 offset
          ctx.clip()

          ctx.strokeStyle = gradient
          ctx.lineWidth = 1
          ctx.lineCap = "round"

          for (let i = 0; i < visibleData.length; i++) {
            const x = (i / Math.max(1, visibleData.length - 1)) * width
            const amplitude = visibleData[i] * amplitudeScale

            if (amplitude > 0.5) {
              const topY = Math.max(padding, centerY - amplitude) // Removed +10
              const bottomY = Math.min(height - padding, centerY + amplitude) // Removed -10

              if (bottomY > topY) {
                ctx.beginPath()
                ctx.moveTo(x, topY)
                ctx.lineTo(x, bottomY)
                ctx.stroke()
              }
            }
          }

          ctx.restore()
        }
      }

      // Draw selection highlight - use either final selection or drag preview
      let selectionToRender = selection

      // If we're dragging, show the preview selection
      if (isDraggingLocal && dragStartTime !== null && dragEndTime !== null) {
        const previewStart = Math.min(dragStartTime, dragEndTime)
        const previewEnd = Math.max(dragStartTime, dragEndTime)
        selectionToRender = { start: previewStart, end: previewEnd }

        console.log("🎯 DRAG PREVIEW:", {
          dragStartTime,
          dragEndTime,
          previewStart,
          previewEnd,
          duration,
        })
      }

      if (selectionToRender && duration > 0) {
        const startProgress = selectionToRender.start / duration
        const endProgress = selectionToRender.end / duration
        const visibleRange = 1 / zoomLevel

        console.log("📊 SELECTION CALCULATION:", {
          selectionStart: selectionToRender.start,
          selectionEnd: selectionToRender.end,
          startProgress,
          endProgress,
          scrollPosition,
          visibleRange,
          zoomLevel,
        })

        // Check if selection overlaps with visible range
        if (endProgress >= scrollPosition && startProgress <= scrollPosition + visibleRange) {
          const selectionStartInVisible = Math.max(0, (startProgress - scrollPosition) / visibleRange)
          const selectionEndInVisible = Math.min(1, (endProgress - scrollPosition) / visibleRange)

          const selectionStartX = selectionStartInVisible * width
          const selectionEndX = selectionEndInVisible * width

          console.log("🖼️ CANVAS COORDINATES:", {
            selectionStartInVisible,
            selectionEndInVisible,
            selectionStartX,
            selectionEndX,
            width,
            calculatedWidth: selectionEndX - selectionStartX,
          })

          // Only draw if we have a valid selection area
          if (selectionEndX > selectionStartX) {
            console.log("✅ DRAWING SELECTION:", {
              x: selectionStartX,
              y: 0,
              width: selectionEndX - selectionStartX,
              height,
            })

            // Draw selection background
            ctx.fillStyle = "rgba(138, 43, 226, 0.3)" // Purple with transparency
            ctx.fillRect(selectionStartX, 0, selectionEndX - selectionStartX, height)

            // Draw selection borders
            ctx.strokeStyle = "#8a2be2"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(selectionStartX, 0)
            ctx.lineTo(selectionStartX, height)
            ctx.moveTo(selectionEndX, 0)
            ctx.lineTo(selectionEndX, height)
            ctx.stroke()
          } else {
            console.log("❌ INVALID SELECTION - endX <= startX")
          }
        } else {
          console.log("👁️ SELECTION NOT VISIBLE")
        }
      }

      // Draw playhead
      if (duration > 0) {
        const timeProgress = currentTime / duration
        const visibleRange = 1 / zoomLevel

        if (timeProgress >= scrollPosition && timeProgress <= scrollPosition + visibleRange) {
          const relativeProgress = (timeProgress - scrollPosition) / visibleRange
          const progressX = relativeProgress * width

          ctx.strokeStyle = "#ef4444"
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(progressX, 0)
          ctx.lineTo(progressX, height)
          ctx.stroke()
        }
      }

      // Draw hover indicator
      if (isHovering && duration > 0) {
        const hoverProgress = hoverTime / duration
        const visibleRange = 1 / zoomLevel

        if (hoverProgress >= scrollPosition && hoverProgress <= scrollPosition + visibleRange) {
          const relativeProgress = (hoverProgress - scrollPosition) / visibleRange
          const hoverX = relativeProgress * width

          ctx.strokeStyle = "#fbbf24"
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.moveTo(hoverX, 0)
          ctx.lineTo(hoverX, height)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }, [
      currentTime,
      duration,
      canvasWidth,
      isHovering,
      hoverTime,
      actualWaveformData,
      zoomLevel,
      scrollPosition,
      selection,
      isDraggingLocal,
      dragStartTime,
      dragEndTime,
    ])

    const handleMouseLeave = () => {
      setIsHovering(false)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!duration) return

      const time = getTimeFromMousePosition(e)
      setHoverTime(time)

      // Update drag end time if we're dragging
      if (isDraggingLocal) {
        setDragEndTime(time)
      }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!duration) return

      // Prevent creating a new selection if one already exists
      if (selection) {
        console.log("🚫 SELECTION EXISTS - Cannot create new selection until current one is cleared")
        return
      }

      const time = getTimeFromMousePosition(e)
      console.log("🖱️ MOUSE DOWN:", { time, duration })

      setIsDraggingLocal(true)
      setDragStartTime(time)
      setDragEndTime(time)
    }

    const handleGlobalMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDraggingLocal || !duration) return

        const time = getTimeFromMousePosition(e)
        console.log("🖱️ MOUSE MOVE:", { time, dragStartTime, duration })
        setDragEndTime(time)
      },
      [isDraggingLocal, duration, getTimeFromMousePosition, dragStartTime],
    )

    const handleGlobalMouseUp = useCallback(() => {
      if (isDraggingLocal && dragStartTime !== null && dragEndTime !== null) {
        const timeDifference = Math.abs(dragEndTime - dragStartTime)

        console.log("🖱️ MOUSE UP:", {
          dragStartTime,
          dragEndTime,
          timeDifference,
          isSelection: timeDifference > 0.1,
        })

        if (timeDifference > 0.1) {
          // 100ms minimum for selection
          // This was a drag - create selection with proper start and end times
          const selectionStart = Math.min(dragStartTime, dragEndTime)
          const selectionEnd = Math.max(dragStartTime, dragEndTime)

          console.log("✅ CREATING SELECTION:", {
            selectionStart,
            selectionEnd,
            duration: selectionEnd - selectionStart,
          })

          // Create selection with the exact dragged range
          onSelectionChange({ start: selectionStart, end: selectionEnd })

          // Set input values to match the exact selection
          const startTimeFormatted = formatTimeWithMilliseconds(selectionStart)
          const endTimeFormatted = formatTimeWithMilliseconds(selectionEnd)
          onStartTimeInputChange(startTimeFormatted)
          onEndTimeInputChange(endTimeFormatted)
        } else {
          // This was a click - only seek if no selection exists
          if (!selection) {
            console.log("👆 CLICK - SEEKING TO:", dragStartTime)
            onSeek(dragStartTime)
          } else {
            console.log("👆 CLICK - Selection exists, not seeking")
          }
          onSelectionChange(null)
          onStartTimeInputChange("")
          onEndTimeInputChange("")
        }
      }

      setIsDraggingLocal(false)
      setDragStartTime(null)
      setDragEndTime(null)
    }, [
      isDraggingLocal,
      dragStartTime,
      dragEndTime,
      selection,
      onSelectionChange,
      onStartTimeInputChange,
      onEndTimeInputChange,
      onSeek,
    ])

    // Add global mouse event listeners for drag operations
    useEffect(() => {
      if (isDraggingLocal) {
        document.addEventListener("mousemove", handleGlobalMouseMove)
        document.addEventListener("mouseup", handleGlobalMouseUp)

        return () => {
          document.removeEventListener("mousemove", handleGlobalMouseMove)
          document.removeEventListener("mouseup", handleGlobalMouseUp)
        }
      }
    }, [isDraggingLocal, handleGlobalMouseMove, handleGlobalMouseUp])

    const parseTimeInput = (input: string): number | null => {
      // Parse formats like "00:01:234" (mm:ss:ms) or just seconds
      const parts = input.split(":")
      if (parts.length === 3) {
        const minutes = Number.parseInt(parts[0]) || 0
        const seconds = Number.parseInt(parts[1]) || 0
        const milliseconds = Number.parseInt(parts[2]) || 0
        return minutes * 60 + seconds + milliseconds / 1000
      } else if (parts.length === 2) {
        const seconds = Number.parseInt(parts[0]) || 0
        const milliseconds = Number.parseInt(parts[1]) || 0
        return seconds + milliseconds / 1000
      } else {
        const time = Number.parseFloat(input)
        return isNaN(time) ? null : time
      }
    }

    const handleStartTimeChange = (value: string) => {
      onStartTimeInputChange(value)
      const time = parseTimeInput(value)
      if (time !== null && time >= 0 && time <= duration && selection) {
        // Only update if we have an existing selection and the new start time is valid
        if (time < selection.end) {
          onSelectionChange({ start: time, end: selection.end })
        }
      }
    }

    const handleEndTimeChange = (value: string) => {
      onEndTimeInputChange(value)
      const time = parseTimeInput(value)
      if (time !== null && time >= 0 && time <= duration && selection) {
        // Only update if we have an existing selection and the new end time is valid
        if (time > selection.start) {
          onSelectionChange({ start: selection.start, end: time })
        }
      }
    }

    const handleScroll = () => {
      // You can add any scroll-related logic here if needed
    }

    if (isLoading) {
      return (
        <div ref={containerRef} className="w-full h-[320px] bg-gray-800 rounded-md flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading audio...</div>
        </div>
      )
    }

    return (
      <div ref={containerRef} className="w-full">
        <div
          ref={scrollContainerRef}
          className="relative overflow-x-auto"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#4a5568 #1a202c",
          }}
        >
          <div style={{ width: zoomLevel > 1 ? `${zoomLevel * 100}%` : "100%" }}>
            <canvas
              ref={canvasRef}
              className={`w-full h-[320px] rounded-md ${selection ? "cursor-not-allowed" : "cursor-pointer"}`}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={handleMouseLeave}
              style={{ touchAction: "none" }}
            />
          </div>
        </div>

        {isHovering && duration > 0 && (
          <div
            className="absolute top-0 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
            style={{
              left: `${((hoverTime / duration - scrollPosition) / (1 / zoomLevel)) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatTimeWithMilliseconds(hoverTime)}
          </div>
        )}
        {/* Selection Controls */}
        <div className="flex items-center gap-4 mt-4 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2">
            <Label htmlFor="startTime" className="text-sm font-medium">
              Start:
            </Label>
            <Input
              id="startTime"
              value={startTimeInput}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              placeholder="00:00:000"
              className="w-24 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="endTime" className="text-sm font-medium">
              End:
            </Label>
            <Input
              id="endTime"
              value={endTimeInput}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              placeholder="00:00:000"
              className="w-24 h-8 text-xs"
            />
          </div>
          {selection && (
            <>
              <div className="text-sm text-muted-foreground">
                Duration: {formatTimeWithMilliseconds(selection.end - selection.start)}
              </div>
              <Button variant="outline" size="sm" onClick={() => onSelectionChange(null)} className="h-8 px-3 text-xs">
                Clear Selection
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Function to analyze audio duration and waveform using Web Audio API
  const analyzeAudioDuration = useCallback(async () => {
    const audioUrl = getAudioUrl()
    if (!audioUrl) return false

    setIsAnalyzingDuration(true)

    try {
      console.log("Analyzing audio duration using Web Audio API...")

      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContext) {
        console.warn("Web Audio API not supported in this browser")
        return false
      }

      const audioContext = new AudioContext()

      // Fetch the audio file
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()

      // Decode the audio data
      const audioBufferDecoded = await audioContext.decodeAudioData(arrayBuffer)

      // Get the precise duration
      const accurateDuration = audioBufferDecoded.duration
      console.log(`Web Audio API detected duration: ${accurateDuration}s`)

      // Update the duration state
      setDuration(accurateDuration)

      // Close the audio context when done
      if (audioContext.state !== "closed" && typeof audioContext.close === "function") {
        await audioContext.close()
      }

      setIsAnalyzingDuration(false)
      return true
    } catch (error) {
      console.error("Error analyzing audio duration:", error)
      setIsAnalyzingDuration(false)
      setDurationDetectionFailed(true)
      return false
    }
  }, [getAudioUrl])

  // Smooth time update using requestAnimationFrame
  const updateCurrentTime = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !isPlayingRef.current || isDragging) return

    const newTime = audio.currentTime
    // Only update if the time has actually changed significantly (reduces unnecessary renders)
    if (Math.abs(newTime - currentTime) > 0.001) {
      setCurrentTime(newTime)
    }

    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime)
    }
  }, [isDragging, currentTime])

  // Function to handle downloading the audio file
  const handleDownload = useCallback(async () => {
    const audioUrl = getAudioUrl()
    if (!audioUrl) {
      toast.error("No audio URL available")
      return
    }

    setIsDownloading(true)
    try {
      // Extract filename from URL or use project name
      let filename = audioUrl.split("/").pop() || `${project.name}.${project.extension || "wav"}`

      // Ensure filename has the correct extension
      if (!filename.includes(".")) {
        filename = `${filename}.${project.extension || "wav"}`
      }

      // Create a temporary anchor element to trigger the download
      const link = document.createElement("a")
      link.href = audioUrl
      link.download = filename
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Download started")
    } catch (error: unknown) {
      console.error("Error downloading audio:", error)
      toast.error("Failed to download audio")
    } finally {
      setIsDownloading(false)
    }
  }, [getAudioUrl, project.name, project.extension])

  // Toggle description visibility
  const toggleDescriptionVisibility = useCallback(() => {
    setIsDescriptionVisible((prev) => !prev)
  }, [])

  // Update the resetAudioElement function to remove audioBuffer reset
  const resetAudioElement = useCallback(() => {
    console.log("Resetting audio element due to error")

    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // First pause and clear the current audio element
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }

    // Reset all state variables
    setIsAudioBroken(false)
    setPlaybackError(null)
    setCurrentTime(0)
    setIsPlaying(false)
    isPlayingRef.current = false
    jumpDetectedRef.current = false
    previousTimeRef.current = 0
    setDurationDetectionFailed(false)

    // Clear any pending timeouts
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current)
      seekTimeoutRef.current = null
    }

    // Force a complete re-render of the audio element with a new key
    setTimeout(() => {
      setAudioKey(Date.now())
    }, 100)
  }, [])

  // Waveform seek handler
  const handleWaveformSeek = useCallback(
    (time: number) => {
      const audio = audioRef.current
      if (!audio || isAudioBroken) return

      const wasPlaying = isPlayingRef.current

      // Pause before seeking
      if (wasPlaying) {
        audio.pause()
      }

      // For waveform seeking, use a much smaller buffer or no buffer at all
      // Only apply buffer if we're very close to the absolute end
      const buffer = 0.05 // Much smaller buffer (50ms) for waveform seeking
      const maxSeekTime = Math.max(0, duration - buffer)
      const seekTime = Math.min(time, maxSeekTime)

      try {
        audio.currentTime = seekTime
        setCurrentTime(seekTime)

        // Resume playback if it was playing before
        if (wasPlaying) {
          setTimeout(() => {
            const playPromise = audio.play()
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                if (!error.message.includes("AbortError")) {
                  console.error("Play error after waveform seek:", error)
                  setPlaybackError("Failed to resume after seeking.")
                }
                isPlayingRef.current = false
                setIsPlaying(false)
              })
            }
          }, 50)
        }
      } catch (error) {
        console.error("Waveform seek error:", error)
        setPlaybackError("Failed to seek to the specified time.")
      }
    },
    [duration, isAudioBroken],
  )

  // Update the useEffect that resets audio when project changes
  useEffect(() => {
    console.log("Audio URL changed:", getAudioUrl())
    setCurrentTime(0)
    setIsPlaying(false)
    isPlayingRef.current = false
    setIsLoading(true)
    setPlaybackError(null)
    setIsAudioBroken(false)
    jumpDetectedRef.current = false
    previousTimeRef.current = 0

    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Try to analyze the audio duration using Web Audio API
    analyzeAudioDuration().then((success) => {
      if (!success) {
        console.log("Falling back to standard audio element for duration")
      }
    })

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [project.id, project.audioUrl, audioKey, getAudioUrl, analyzeAudioDuration])

  // Fixed: Update the useEffect that tracks the current word index to be more precise
  useEffect(() => {
    if (!transcription?.words) {
      setCurrentWordIndex(null)
      return
    }

    // If at the beginning of the audio and not playing, and no manual selection, don't highlight any word
    if (currentTime === 0 && !isPlaying && !manualWordSelection) {
      setCurrentWordIndex(null)
      return
    }

    // Find the word that contains the current time
    let foundIndex = null

    for (let i = 0; i < transcription.words.length; i++) {
      const word = transcription.words[i]
      const startTime = getStartTime(word)
      const endTime = getEndTime(word)

      // Check if current time falls within this word's range
      if (currentTime >= startTime && currentTime < endTime) {
        foundIndex = i
        break
      }
    }

    // If no exact match found, find the closest word before the current time
    if (foundIndex === null && currentTime > 0) {
      for (let i = transcription.words.length - 1; i >= 0; i--) {
        const word = transcription.words[i]
        const startTime = getStartTime(word)

        if (currentTime >= startTime) {
          foundIndex = i
          break
        }
      }
    }

    // If we're at time 0 and there was a manual selection, keep the selection
    if (currentTime === 0 && manualWordSelection) {
      // Don't change the current word index
      return
    }

    setCurrentWordIndex(foundIndex)

    // Reset manual selection flag when time changes
    if (currentTime > 0) {
      setManualWordSelection(false)
    }
  }, [currentTime, transcription, isPlaying, manualWordSelection])

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
  }, [currentWordIndex, transcription])

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      console.log("Audio metadata loaded, reported duration:", audio.duration)

      // Only set duration from metadata if Web Audio API analysis failed
      if (durationDetectionFailed || !duration) {
        setDuration(audio.duration)
      }

      setIsLoading(false)
      setPlaybackError(null)
      setIsAudioBroken(false)
    }

    // Replace the handleTimeUpdate function in the useEffect that sets up audio event listeners
    const handleTimeUpdate = () => {
      if (isAudioBroken) return

      const currentTime = audio.currentTime
      const previousTime = previousTimeRef.current

      // Simple detection: if we're playing and time suddenly jumps backward significantly,
      // we've hit the actual end of the audio
      if (isPlayingRef.current && previousTime > 2 && currentTime < 1 && !jumpDetectedRef.current) {
        console.log(`Detected unexpected jump from ${previousTime}s to ${currentTime}s - likely actual end of audio`)
        jumpDetectedRef.current = true

        // If we're playing, pause and reset to beginning
        if (isPlayingRef.current) {
          audio.pause()
          isPlayingRef.current = false
          setIsPlaying(false)
          audio.currentTime = 0
          setCurrentTime(0)

          // Cancel animation frame
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }

          // Update duration if we detected a shorter actual duration
          if (previousTime < duration - 1) {
            console.log(`Updating duration from ${duration}s to ${previousTime}s based on playback jump`)
            setDuration(previousTime)
          }
        }

        return
      }

      // Update previous time for jump detection
      previousTimeRef.current = currentTime

      // Only update current time if not using smooth animation
      if (!isPlayingRef.current) {
        setCurrentTime(currentTime)
      }
    }

    const handleCanPlay = () => {
      console.log("Audio can play")
      setIsLoading(false)
      setPlaybackError(null)
      setIsAudioBroken(false)
    }

    const handleEnded = () => {
      isPlayingRef.current = false
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    const handlePlay = () => {
      if (!isAudioBroken) {
        isPlayingRef.current = true
        setIsPlaying(true)
        setPlaybackError(null)

        // Start smooth time updates
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        animationFrameRef.current = requestAnimationFrame(updateCurrentTime)
      }
    }

    const handlePause = () => {
      isPlayingRef.current = false
      setIsPlaying(false)

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    const handleStalled = () => {
      // Only consider stalls during playback and when we're near the end
      if (isPlayingRef.current && audio.currentTime > duration * 0.7) {
        console.log("Audio stalled near end at time:", audio.currentTime)

        // Clear any existing stall timeout
        if (stallTimeoutRef.current) {
          clearTimeout(stallTimeoutRef.current)
        }
      }
    }

    const handleWaiting = () => {
      // Similar to stalled, but triggered when buffering
      if (isPlayingRef.current && audio.currentTime > duration * 0.7) {
        console.log("Audio waiting/buffering near end at time:", audio.currentTime)
        handleStalled()
      }
    }

    const handleError = (e: Event) => {
      console.error("Audio error:", e)
      const audioElement = e.target as HTMLAudioElement
      if (audioElement.error) {
        console.error("Audio error details:", audioElement.error)

        // Mark audio as broken to prevent further operations
        setIsAudioBroken(true)
        isPlayingRef.current = false
        setIsPlaying(false)

        // Cancel animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        // Handle specific error codes
        switch (audioElement.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            setPlaybackError("Audio playback was aborted.")
            break
          case MediaError.MEDIA_ERR_NETWORK:
            setPlaybackError("Network error occurred while loading audio.")
            break
          case MediaError.MEDIA_ERR_DECODE:
            setPlaybackError("Audio decoding error. Try seeking to a different position or reload the audio.")
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setPlaybackError("Audio format not supported.")
            break
          default:
            setPlaybackError(`Audio error: ${audioElement.error.message}. Click 'Reset Audio' to recover.`)
        }
      } else {
        setPlaybackError("Error loading audio. Please try again.")
      }
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
  }, [audioKey, isAudioBroken, duration, durationDetectionFailed, updateCurrentTime])

  // Scroll to the current word in the transcript
  useEffect(() => {
    if (!transcription?.words || !transcriptRef.current || currentWordIndex === null) return

    // Find the current word element
    const wordElements = transcriptRef.current.querySelectorAll("[data-word-index]")
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
    if (!audio || isAudioBroken) return

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
            // Only log non-abort errors to avoid spam
            if (!error.message.includes("AbortError")) {
              console.error("Play error:", error)
              setPlaybackError("Failed to play audio. Try resetting the audio player.")
            }
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error: unknown) {
        console.error("Play error:", error)
        setPlaybackError("Failed to play audio. Try resetting the audio player.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [isAudioBroken])

  const handleSeek = useCallback(
    (value: number[]) => {
      const audio = audioRef.current
      if (!audio || !duration || isAudioBroken) return

      const seekTime = Math.max(0, Math.min(value[0], duration - getSeekBuffer()))

      // Update current time immediately for visual feedback
      setCurrentTime(seekTime)

      // Set dragging state
      setIsDragging(true)

      // Clear any pending seek operations
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }

      const wasPlaying = isPlayingRef.current

      // Pause before seeking to avoid race conditions
      if (wasPlaying) {
        audio.pause()
      }

      // Reduced debounce time for more responsive seeking
      seekTimeoutRef.current = setTimeout(() => {
        try {
          audio.currentTime = seekTime
          setIsDragging(false)

          // Resume playback if it was playing before
          if (wasPlaying && !isAudioBroken) {
            setTimeout(() => {
              try {
                const playPromise = audio.play()
                if (playPromise !== undefined) {
                  playPromise.catch((error) => {
                    if (!error.message.includes("AbortError")) {
                      console.error("Play error after seek:", error)
                      setPlaybackError("Failed to resume after seeking. Try clicking play again.")
                    }
                    isPlayingRef.current = false
                    setIsPlaying(false)
                  })
                }
              } catch (error: unknown) {
                console.error("Play error after seek:", error)
                setPlaybackError("Failed to resume after seeking. Try clicking play again.")
                isPlayingRef.current = false
                setIsPlaying(false)
              }
            }, 50)
          }
        } catch (error: unknown) {
          console.error("Seek error:", error)
          setPlaybackError("Failed to seek to the specified time. Try a different position or reset the audio.")
          setIsAudioBroken(true)
          setIsDragging(false)
        }
      }, 50) // Reduced from 100ms to 50ms for more responsiveness
    },
    [duration, isAudioBroken, getSeekBuffer],
  )

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
    if (!audio || isAudioBroken) return

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
            if (!error.message.includes("AbortError")) {
              console.error("Play error after skip backward:", error)
              setPlaybackError("Failed to resume after skipping. Please try again.")
            }
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error: unknown) {
        console.error("Play error after skip backward:", error)
        setPlaybackError("Failed to resume after skipping. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [isAudioBroken])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio || isAudioBroken) return

    const wasPlaying = isPlayingRef.current

    // Pause before seeking to avoid race conditions
    if (wasPlaying) {
      audio.pause()
    }

    const buffer = getSeekBuffer()
    const maxTime = Math.max(0, duration - buffer)
    audio.currentTime = Math.min(maxTime, audio.currentTime + 10)
    setCurrentTime(audio.currentTime)

    // Resume playback if it was playing before
    if (wasPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (!error.message.includes("AbortError")) {
              console.error("Play error after skip forward:", error)
              setPlaybackError("Failed to resume after skipping. Please try again.")
            }
            isPlayingRef.current = false
            setIsPlaying(false)
          })
        }
      } catch (error: unknown) {
        console.error("Play error after skip forward:", error)
        setPlaybackError("Failed to resume after skipping. Please try again.")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [duration, isAudioBroken, getSeekBuffer])

  // 2. Update the seekToWordTime function to ensure it seeks to the exact time
  const seekToWordTime = useCallback(
    (word: WordTimestamp) => {
      const audio = audioRef.current
      if (!audio || isAudioBroken) return

      const wasPlaying = isPlayingRef.current

      // Get the exact start time of the word
      const startTime = getStartTime(word)

      console.log("Seeking to word:", word.word, "at exact time:", startTime)

      // Pause before seeking to avoid race conditions
      if (wasPlaying) {
        audio.pause()
      }

      // Set the current time precisely
      audio.currentTime = startTime
      setCurrentTime(startTime)

      // Resume playback if it was playing before
      if (wasPlaying) {
        try {
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              if (!error.message.includes("AbortError")) {
                console.error("Play error after seek to word:", error)
                setPlaybackError("Failed to resume after seeking to word. Please try again.")
              }
              isPlayingRef.current = false
              setIsPlaying(false)
            })
          }
        } catch (error: unknown) {
          console.error("Play error after seek to word:", error)
          setPlaybackError("Failed to resume after seeking to word. Please try again.")
          isPlayingRef.current = false
          setIsPlaying(false)
        }
      }
    },
    [isAudioBroken],
  )

  const handleWordClick = useCallback((word: WordTimestamp) => {
    setSelectedWord(word)
    setIsWordDialogOpen(true)
  }, [])

  // Function to handle clicking on a word in the transcript
  const handleTranscriptWordClick = useCallback(
    (word: WordTimestamp, index: number) => {
      console.log("Clicked word:", word.word, "at index:", index, "with start time:", getStartTime(word))
      seekToWordTime(word)
    },
    [seekToWordTime],
  )

  // Fixed: Completely rewritten renderHighlightedTranscript to fix spacing and targeting
  const renderHighlightedTranscript = () => {
    if (!transcription || !transcription.words || transcription.words.length === 0) {
      return <p>{transcription?.transcript || ""}</p>
    }

    return (
      <div className="relative leading-relaxed" ref={transcriptRef}>
        {transcription.words.map((word, index) => {
          const isCurrentWord = index === currentWordIndex
          const isSearchMatch = isSearchActive && searchResults.some((result) => result.wordIndex === index)
          const displayWord = word.word.replace(/^\s+/, "")

          return (
            <span key={index}>
              <span
                data-word-index={index}
                className={`cursor-pointer hover:bg-blue-200 hover:dark:bg-blue-800/50 hover:shadow-sm transition-all duration-150 ease-in-out transform hover:scale-105 rounded-sm relative ${
                  isCurrentWord ? "bg-yellow-300 dark:bg-yellow-700 font-medium" : ""
                } ${isSearchMatch ? "bg-green-300 dark:bg-green-700 font-medium ring-2 ring-green-500" : ""}`}
                onClick={() => {
                  const startTime = getStartTime(word)
                  console.log(`Clicked word "${word.word}" at index ${index}, setting time to ${startTime}`)

                  setCurrentWordIndex(index)
                  setManualWordSelection(true)

                  if (audioRef.current && !isAudioBroken) {
                    audioRef.current.currentTime = startTime
                    setCurrentTime(startTime)
                  }
                }}
              >
                {displayWord}
              </span>
              {index < transcription.words.length - 1 && " "}
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
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
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

  // Update the handleFormatConversion function to handle format-specific errors
  const handleFormatConversion = async () => {
    if (!targetFormat) {
      toast.error("Please select a target format")
      return
    }

    setIsConverting(true)
    try {
      console.log("Sending format conversion request with:", {
        projectId: project.id,
        targetFormat,
      })

      // Show a more detailed toast for potentially problematic formats
      if (["m4a", "aac", "flac"].includes(targetFormat)) {
        toast.info(`Converting to ${targetFormat.toUpperCase()}. This may take longer than other formats.`, {
          duration: 5000,
        })
      }

      const response = await httpClient.post(`/api/audio/${project.id}/convert-format`, null, {
        params: {
          target_format: targetFormat,
        },
      })

      console.log("Format conversion response received:", response.data)

      // The response contains the new audio URL
      const newAudioUrl = response.data.audioUrl

      if (newAudioUrl) {
        console.log("New audio URL:", newAudioUrl)

        // Update the project's extension
        project.extension = targetFormat

        // Pass the new audio URL to update everything
        await handleModificationComplete(newAudioUrl)
        toast.success(`Audio converted to ${targetFormat.toUpperCase()} successfully`)
        setIsConvertDialogOpen(false)
      } else {
        console.error("No audio URL in response")
        toast.error("Failed to update audio. Please refresh the page.")
      }
    } catch (error: any) {
      console.error("Error converting audio format:", error)

      // Type-safe error handling
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "detail" in error.response.data
      ) {
        const errorDetail = (error.response.data as { detail: string }).detail

        if (errorDetail.includes("m4a") || errorDetail.includes("aac")) {
          toast.error(
            `Failed to convert to ${targetFormat.toUpperCase()}. Your FFmpeg installation may not support this format.`,
            {
              duration: 8000,
            },
          )
        } else if (errorDetail.includes("flac") && errorDetail.includes("compression")) {
          toast.error(`Failed to convert to FLAC. Try updating pydub or using a different format.`, {
            duration: 8000,
          })
        } else {
          toast.error(`Failed to convert audio format: ${errorDetail.split("\n")[0]}`)
        }
      } else {
        toast.error(`Failed to convert audio format. Please try a different format.`)
      }
    } finally {
      setIsConverting(false)
      setTargetFormat("")
    }
  }

  // Check if project has a description
  const hasDescription = Boolean(project.description && project.description.trim().length > 0)

  // Calculate the safe maximum seek time
  const safeMaxSeekTime = Math.max(0, duration - getSeekBuffer())

  const handleSelectionChange = useCallback((newSelection: { start: number; end: number } | null) => {
    setSelection(newSelection)
  }, [])

  const parseTimeInput = useCallback((input: string): number | null => {
    // Parse formats like "00:01:234" (mm:ss:ms) or just seconds
    const parts = input.split(":")
    if (parts.length === 3) {
      const minutes = Number.parseInt(parts[0]) || 0
      const seconds = Number.parseInt(parts[1]) || 0
      const milliseconds = Number.parseInt(parts[2]) || 0
      return minutes * 60 + seconds + milliseconds / 1000
    } else if (parts.length === 2) {
      const seconds = Number.parseInt(parts[0]) || 0
      const milliseconds = Number.parseInt(parts[1]) || 0
      return seconds + milliseconds / 1000
    } else {
      const time = Number.parseFloat(input)
      return isNaN(time) ? null : time
    }
  }, [])

  const handleStartTimeInputChange = useCallback(
    (value: string) => {
      setStartTimeInput(value)
      // Don't create new selections, only modify existing ones
      if (!selection) return

      const time = parseTimeInput(value)
      if (time !== null && time >= 0 && time <= duration && time !== selection.start) {
        if (time < selection.end) {
          setSelection({ start: time, end: selection.end })
        }
      }
    },
    [duration, selection, parseTimeInput],
  )

  const handleEndTimeInputChange = useCallback(
    (value: string) => {
      setEndTimeInput(value)
      // Don't create new selections, only modify existing ones
      if (!selection) return

      const time = parseTimeInput(value)
      if (time !== null && time >= 0 && time <= duration && time !== selection.end) {
        if (time > selection.start) {
          setSelection({ start: selection.start, end: time })
        }
      }
    },
    [duration, selection, parseTimeInput],
  )

  const clearSelection = useCallback(() => {
    setSelection(null)
    setStartTimeInput("")
    setEndTimeInput("")
  }, [])

  const handleSearch = useCallback(() => {
    if (!transcription?.words || !searchQuery.trim()) {
      setSearchResults([])
      setIsSearchActive(false)
      return
    }

    try {
      let regex: RegExp

      if (exactMatch) {
        // Exact word match - use word boundaries
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        regex = new RegExp(`\\b${escapedQuery}\\b`, "i") // case-insensitive with word boundaries
      } else {
        // Substring search - escape special regex characters and make case-insensitive
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        regex = new RegExp(escapedQuery, "i") // case-insensitive
      }

      const results: { wordIndex: number; word: WordTimestamp }[] = []

      transcription.words.forEach((word, index) => {
        if (regex.test(word.word)) {
          results.push({ wordIndex: index, word })
        }
      })

      setSearchResults(results)
      setIsSearchActive(true)

      if (results.length === 0) {
        toast.info("No matches found")
      } else {
        toast.success(`Found ${results.length} matches`)
      }
    } catch (error) {
      toast.error("Search error")
      setSearchResults([])
      setIsSearchActive(false)
    }
  }, [transcription, searchQuery, exactMatch])

  const clearSearch = useCallback(() => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearchActive(false)
  }, [])

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            {project.name}
            {project.extension && (
              <span className="text-2xl font-normal italic text-muted-foreground ml-2">.{project.extension}</span>
            )}
          </h1>
          {hasDescription && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleDescriptionVisibility}
              title={isDescriptionVisible ? "Hide description" : "Show description"}
            >
              {isDescriptionVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {hasDescription && isDescriptionVisible && <p className="text-muted-foreground">{project.description}</p>}
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

            {isLoading || isAnalyzingDuration ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAnalyzingDuration ? "Analyzing audio duration..." : "Loading audio..."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Waveform Visualization */}
                <div className="space-y-2">
                  <WaveformVisualization
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleWaveformSeek}
                    isLoading={isLoading || isAnalyzingDuration}
                    selection={selection}
                    onSelectionChange={handleSelectionChange}
                    startTimeInput={startTimeInput}
                    endTimeInput={endTimeInput}
                    onStartTimeInputChange={handleStartTimeInputChange}
                    onEndTimeInputChange={handleEndTimeInputChange}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{formatTimeWithMilliseconds(currentTime)}</span>
                  <span className="text-sm font-medium">{formatTimeWithMilliseconds(duration)}</span>
                </div>

                <Slider
                  value={[currentTime]}
                  max={safeMaxSeekTime || 1}
                  step={0.001} // Much more precise stepping (1ms precision)
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                  disabled={duration === 0 || isAudioBroken}
                />

                {playbackError && (
                  <div className="text-destructive text-sm py-1 bg-destructive/10 px-3 rounded">
                    {playbackError}
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-2 h-auto p-0 text-destructive"
                      onClick={resetAudioElement}
                    >
                      Reset Audio
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipBackward}
                      className="hover:bg-primary/10"
                      disabled={isAudioBroken}
                    >
                      <SkipBack className="h-5 w-5" />
                    </Button>

                    <Button
                      variant="default"
                      size="icon"
                      onClick={togglePlayPause}
                      className="h-10 w-10 rounded-full"
                      disabled={duration === 0 || isAudioBroken}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipForward}
                      className="hover:bg-primary/10"
                      disabled={isAudioBroken}
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      disabled={isDownloading || !project.audioUrl}
                      className="flex items-center gap-1"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Download className="h-4 w-4 mr-1" />
                      )}
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <Button onClick={onTranscribe} disabled={isTranscribing || isModifying || isConverting}>
            {isTranscribing ? "Transcribing..." : transcription ? "Retranscribe" : "Transcribe Audio"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsConvertDialogOpen(true)}
            disabled={isTranscribing || isModifying || isConverting}
            className="flex items-center gap-1"
          >
            <FileType className="h-4 w-4 mr-1" />
            Convert Format
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsSelectionModifyDialogOpen(true)}
            disabled={isTranscribing || isModifying || isConverting || (!selection && !isSearchActive)}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4 mr-1" />
            Apply Modification
          </Button>

          {/* Search Box */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2">
              <Switch id="exactMatch" checked={exactMatch} onCheckedChange={setExactMatch} />
              <Label htmlFor="exactMatch" className="text-sm whitespace-nowrap">
                Exact match
              </Label>
            </div>
            <Input
              placeholder="Search transcript"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
              disabled={!transcription?.words}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearch}
              disabled={!transcription?.words || !searchQuery.trim()}
            >
              Search
            </Button>
            {isSearchActive && (
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </div>
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
                  <tr className="bg-gray-300 dark:bg-gray-700">
                    <th className="text-left py-2 px-3 font-medium border-b">Word</th>
                    <th className="text-left py-2 px-3 font-medium border-b">Start Time</th>
                    <th className="text-left py-2 px-3 font-medium border-b">End Time</th>
                    <th className="py-2 px-3 border-b">
                      <div className="flex items-center">
                        <span className="font-normal ml-[calc(100%-160px)]">Actions</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transcription.words.map((word, index) => {
                    const isCurrentWord = index === currentWordIndex
                    const isSearchMatch = isSearchActive && searchResults.some((result) => result.wordIndex === index)

                    return (
                      <tr
                        key={index}
                        className={`hover:bg-muted-foreground/10 ${
                          isCurrentWord && currentWordIndex !== null ? "bg-muted-foreground/5" : ""
                        } ${isSearchMatch ? "bg-green-100 dark:bg-green-900/30" : ""}`}
                      >
                        <td className={`py-2 px-3 ${isSearchMatch ? "font-medium" : ""}`}>{word.word}</td>
                        <td className="py-2 px-3">{formatTimeWithMilliseconds(getStartTime(word))}</td>
                        <td className="py-2 px-3">{formatTimeWithMilliseconds(getEndTime(word))}</td>
                        <td className="py-2 px-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => seekToWordTime(word)}
                              disabled={isAudioBroken}
                            >
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

      {/* Format conversion dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert Audio Format</DialogTitle>
            <DialogDescription>Convert your audio file to a different format.</DialogDescription>
            <div className="text-base font-medium mt-3">
              Current format: <span className="font-semibold">{project.extension?.toUpperCase() || "Unknown"}</span>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Format</Label>
              <RadioGroup value={targetFormat} onValueChange={setTargetFormat}>
                <div className="grid grid-cols-2 gap-2">
                  {/* Highly compatible formats */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">Recommended</p>
                    {["mp3", "wav", "ogg"]
                      .filter((format) => format !== project.extension?.toLowerCase())
                      .map((format) => (
                        <div key={format} className="flex items-center space-x-2">
                          <RadioGroupItem value={format} id={format} />
                          <Label htmlFor={format} className="cursor-pointer">
                            {format.toUpperCase()}
                          </Label>
                        </div>
                      ))}
                  </div>

                  {/* Less compatible formats */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      May have compatibility issues
                    </p>
                    {["flac", "aac", "m4a"]
                      .filter((format) => format !== project.extension?.toLowerCase())
                      .map((format) => (
                        <div key={format} className="flex items-center space-x-2">
                          <RadioGroupItem value={format} id={format} />
                          <Label htmlFor={format} className="cursor-pointer">
                            {format.toUpperCase()}
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConvertDialogOpen(false)
                  setTargetFormat("")
                }}
                disabled={isConverting}
              >
                Cancel
              </Button>
              <Button onClick={handleFormatConversion} disabled={isConverting || !targetFormat}>
                {isConverting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <FileType className="mr-2 h-4 w-4" />
                    Convert
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selection modification dialog */}
      <Dialog open={isSelectionModifyDialogOpen} onOpenChange={setIsSelectionModifyDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Apply Modification</DialogTitle>
            <DialogDescription>
              {isSearchActive && searchResults.length > 0
                ? `Apply operations to ${searchResults.length} search results`
                : selection
                  ? `Apply operations to the selected time range: ${formatTimeWithMilliseconds(selection.start)} - ${formatTimeWithMilliseconds(selection.end)}`
                  : "No selection or search results"}
            </DialogDescription>
          </DialogHeader>

          {isSearchActive && searchResults.length > 0 ? (
            <BatchAudioModificationOptions
              projectId={project.id}
              searchResults={searchResults}
              onModificationComplete={handleModificationComplete}
              onClose={() => setIsSelectionModifyDialogOpen(false)}
            />
          ) : selection ? (
            <AudioModificationOptions
              projectId={project.id}
              selectedWord={{
                word: `Selection (${formatTimeWithMilliseconds(selection.end - selection.start)})`,
                startTime: selection.start,
                endTime: selection.end,
                start_time: selection.start,
                end_time: selection.end,
              }}
              onModificationComplete={handleModificationComplete}
              onClose={() => setIsSelectionModifyDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// AudioModificationOptions component
interface AudioModificationOptionsProps {
  projectId: number
  selectedWord: WordTimestamp
  onModificationComplete: (newAudioUrl?: string) => Promise<void>
  onClose: () => void
}

const AudioModificationOptions: React.FC<AudioModificationOptionsProps> = ({
  projectId,
  selectedWord,
  onModificationComplete,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationType, setModificationType] = useState<"mute" | "tts" | "tone">("mute")
  const [replacementText, setReplacementText] = useState("")
  const [useEdgeTts, setUseEdgeTts] = useState(true)
  const [gender, setGender] = useState<"male" | "female">("male")
  const [toneFrequency, setToneFrequency] = useState(440) // Default to A4 (440 Hz)
  const [useFixedDuration, setUseFixedDuration] = useState(true)

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
    } catch (error: unknown) {
      console.error("Error muting audio:", error)
      toast.error("Failed to mute audio section")
      setIsProcessing(false)
    }
  }

  // New function to handle tone replacement
  const handleReplaceWithTone = async () => {
    setIsProcessing(true)
    try {
      console.log("Sending tone replacement request with:", {
        projectId,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        toneFrequency,
      })

      const response = await httpClient.post(`/api/audio/${projectId}/replace-with-tone`, null, {
        params: {
          start_time: startTime,
          end_time: endTime,
          tone_frequency: toneFrequency,
        },
      })

      console.log("Tone replacement response received:", response.data)

      // The response directly contains the audioUrl
      const newAudioUrl = response.data.audioUrl

      if (newAudioUrl) {
        console.log("New audio URL:", newAudioUrl)

        // Pass the new audio URL to the parent component
        await onModificationComplete(newAudioUrl)
        toast.success("Audio replaced with tone successfully")
        onClose()
      } else {
        console.error("No audio URL in response")
        toast.error("Failed to update audio. Please refresh the page.")
        setIsProcessing(false)
      }
    } catch (error: unknown) {
      console.error("Error replacing with tone:", error)
      toast.error("Failed to replace audio with tone")
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
          end_time: useFixedDuration ? endTime : undefined,
          replacement_text: replacementText,
          use_edge_tts: useEdgeTts,
          ...(useEdgeTts && { gender: gender }), // Only include gender when Edge TTS is enabled
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
    } catch (error: unknown) {
      console.error("Error replacing with TTS:", error)
      toast.error("Failed to replace audio with TTS")
      setIsProcessing(false)
    }
  }

  const handleSubmit = async () => {
    if (modificationType === "mute") {
      await handleMuteAudio()
    } else if (modificationType === "tone") {
      await handleReplaceWithTone()
    } else {
      await handleReplaceWithTts()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">Start Time:</span>
          <span>{formatTimeWithMilliseconds(startTime)}</span>
        </div>
        {(modificationType !== "tts" || useFixedDuration) && (
          <>
            <div className="flex justify-between">
              <span className="font-medium">End Time:</span>
              <span>{formatTimeWithMilliseconds(endTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Duration:</span>
              <span>{((endTime - startTime) * 1000).toFixed(0) + " ms"}</span>
            </div>
          </>
        )}
        {modificationType === "tts" && !useFixedDuration && (
          <div className="flex justify-between">
            <span className="font-medium">Mode:</span>
            <span className="text-muted-foreground">Auto duration</span>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <Label>Modification Type</Label>
        <RadioGroup
          value={modificationType}
          onValueChange={(value) => setModificationType(value as "mute" | "tts" | "tone")}
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
            <RadioGroupItem value="tone" id="tone" />
            <Label htmlFor="tone" className="flex items-center cursor-pointer">
              <Music className="h-4 w-4 mr-2" />
              Replace with Tone
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

      {modificationType === "tone" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="toneFrequency">Tone Frequency (Hz)</Label>
            </div>
            <Input
              id="toneFrequency"
              type="number"
              min="20"
              max="20000"
              value={toneFrequency}
              onChange={(e) => setToneFrequency(Number.parseInt(e.target.value) || 440)}
              className="w-full"
            />
            <Slider
              value={[toneFrequency]}
              min={80}
              max={1200}
              step={1}
              onValueChange={(value) => setToneFrequency(value[0])}
              className="mt-6"
            />
          </div>
        </div>
      )}

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
            <div className="flex items-center justify-between">
              <Label htmlFor="useFixedDuration">Use fixed duration</Label>
              <Switch id="useFixedDuration" checked={useFixedDuration} onCheckedChange={setUseFixedDuration} />
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, TTS will fit exactly into the selected time range. When disabled, TTS duration will be
              determined automatically by the speech length.
            </p>
          </div>

          {useEdgeTts && (
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
              <p className="text-xs text-muted-foreground">Select the voice gender for Edge TTS synthesis.</p>
            </div>
          )}
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
          ) : modificationType === "tone" ? (
            <>
              <Music className="mr-2 h-4 w-4" />
              Apply Tone
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

// BatchAudioModificationOptions component
interface BatchAudioModificationOptionsProps {
  projectId: number
  searchResults: { wordIndex: number; word: WordTimestamp }[]
  onModificationComplete: (newAudioUrl?: string) => Promise<void>
  onClose: () => void
}

const BatchAudioModificationOptions: React.FC<BatchAudioModificationOptionsProps> = ({
  projectId,
  searchResults,
  onModificationComplete,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationType, setModificationType] = useState<"mute" | "tts" | "tone">("mute")
  const [replacementText, setReplacementText] = useState("")
  const [useEdgeTts, setUseEdgeTts] = useState(true)
  const [gender, setGender] = useState<"male" | "female">("male")
  const [toneFrequency, setToneFrequency] = useState(440)
  const [useFixedDuration, setUseFixedDuration] = useState(true)
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set(searchResults.map((r) => r.wordIndex)))
  const [processedCount, setProcessedCount] = useState(0)

  const getStartTime = (word: WordTimestamp): number => {
    if (word.startTime !== undefined) return Number(word.startTime)
    if (word.start_time !== undefined) return Number(word.start_time)
    return 0
  }

  const getEndTime = (word: WordTimestamp): number => {
    if (word.endTime !== undefined) return Number(word.endTime)
    if (word.end_time !== undefined) return Number(word.end_time)
    return 0
  }

  const toggleWordSelection = (wordIndex: number) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordIndex)) {
      newSelected.delete(wordIndex)
    } else {
      newSelected.add(wordIndex)
    }
    setSelectedWords(newSelected)
  }

  const selectAll = () => {
    setSelectedWords(new Set(searchResults.map((r) => r.wordIndex)))
  }

  const selectNone = () => {
    setSelectedWords(new Set())
  }

  const handleBatchModification = async () => {
    const selectedResults = searchResults.filter((result) => selectedWords.has(result.wordIndex))

    if (selectedResults.length === 0) {
      toast.error("No words selected")
      return
    }

    setIsProcessing(true)
    setProcessedCount(0)

    try {
      let lastAudioUrl: string | undefined

      for (let i = 0; i < selectedResults.length; i++) {
        const result = selectedResults[i]
        const word = result.word
        const startTime = getStartTime(word)
        const endTime = getEndTime(word)

        console.log(`Processing word ${i + 1}/${selectedResults.length}: "${word.word}"`)

        try {
          let response

          if (modificationType === "mute") {
            response = await httpClient.post(`/api/audio/${projectId}/mute-audio`, null, {
              params: {
                start_time: startTime,
                end_time: endTime,
              },
            })
          } else if (modificationType === "tone") {
            response = await httpClient.post(`/api/audio/${projectId}/replace-with-tone`, null, {
              params: {
                start_time: startTime,
                end_time: endTime,
                tone_frequency: toneFrequency,
              },
            })
          } else {
            response = await httpClient.post(`/api/audio/${projectId}/replace-with-tts`, null, {
              params: {
                start_time: startTime,
                end_time: useFixedDuration ? endTime : undefined,
                replacement_text: replacementText || word.word,
                use_edge_tts: useEdgeTts,
                ...(useEdgeTts && { gender: gender }),
              },
            })
          }

          if (response.data.audioUrl) {
            lastAudioUrl = response.data.audioUrl
          }

          setProcessedCount(i + 1)

          // Small delay between requests to avoid overwhelming the server
          if (i < selectedResults.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Error processing word "${word.word}":`, error)
          toast.error(`Failed to process word "${word.word}"`)
        }
      }

      if (lastAudioUrl) {
        await onModificationComplete(lastAudioUrl)
        toast.success(`Successfully processed ${selectedResults.length} words`)
        onClose()
      } else {
        toast.error("No audio URL received from server")
      }
    } catch (error) {
      console.error("Batch modification error:", error)
      toast.error("Failed to complete batch modification")
    } finally {
      setIsProcessing(false)
      setProcessedCount(0)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-medium">Found Words ({searchResults.length})</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              Select None
            </Button>
          </div>
        </div>

        <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
          {searchResults.map((result) => (
            <div key={result.wordIndex} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedWords.has(result.wordIndex)}
                onChange={() => toggleWordSelection(result.wordIndex)}
                className="rounded"
              />
              <span className="text-sm">
                "{result.word.word}" ({formatTimeWithMilliseconds(getStartTime(result.word))} -{" "}
                {formatTimeWithMilliseconds(getEndTime(result.word))})
              </span>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedWords.size} of {searchResults.length} words selected
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Label>Modification Type</Label>
        <RadioGroup
          value={modificationType}
          onValueChange={(value) => setModificationType(value as "mute" | "tts" | "tone")}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mute" id="batch-mute" />
            <Label htmlFor="batch-mute" className="flex items-center cursor-pointer">
              <VolumeX className="h-4 w-4 mr-2" />
              Mute Words
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tone" id="batch-tone" />
            <Label htmlFor="batch-tone" className="flex items-center cursor-pointer">
              <Music className="h-4 w-4 mr-2" />
              Replace with Tone
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tts" id="batch-tts" />
            <Label htmlFor="batch-tts" className="flex items-center cursor-pointer">
              <Mic className="h-4 w-4 mr-2" />
              Replace with TTS
            </Label>
          </div>
        </RadioGroup>
      </div>

      {modificationType === "tone" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-toneFrequency">Tone Frequency (Hz)</Label>
            </div>
            <Input
              id="batch-toneFrequency"
              type="number"
              min="20"
              max="20000"
              value={toneFrequency}
              onChange={(e) => setToneFrequency(Number.parseInt(e.target.value) || 440)}
              className="w-full"
            />
            <Slider
              value={[toneFrequency]}
              min={80}
              max={1200}
              step={1}
              onValueChange={(value) => setToneFrequency(value[0])}
              className="mt-6"
            />
          </div>
        </div>
      )}

      {modificationType === "tts" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="batch-replacementText">Replacement Text (leave empty to use original word)</Label>
            <Textarea
              id="batch-replacementText"
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              placeholder="Leave empty to use each word's original text"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-useEdgeTts">Use Edge TTS (faster)</Label>
              <Switch id="batch-useEdgeTts" checked={useEdgeTts} onCheckedChange={setUseEdgeTts} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-useFixedDuration">Use fixed duration</Label>
              <Switch id="batch-useFixedDuration" checked={useFixedDuration} onCheckedChange={setUseFixedDuration} />
            </div>
          </div>

          {useEdgeTts && (
            <div className="space-y-2">
              <Label>Voice Gender</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as "male" | "female")}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="batch-male" />
                  <Label htmlFor="batch-male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="batch-female" />
                  <Label htmlFor="batch-female">Female</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Processing: {processedCount} / {selectedWords.size} words
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(processedCount / selectedWords.size) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button onClick={handleBatchModification} disabled={isProcessing || selectedWords.size === 0}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing ({processedCount}/{selectedWords.size})
            </>
          ) : (
            <>
              Apply to {selectedWords.size} word{selectedWords.size !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
