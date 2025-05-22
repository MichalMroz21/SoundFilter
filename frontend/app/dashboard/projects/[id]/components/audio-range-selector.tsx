"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { formatTime } from "@/lib/utils"
import { Mic, VolumeX, X } from "lucide-react"
import type { TranscriptionResult, WordTimestamp } from "@/models/audio/TranscriptionResult"

interface AudioRangeSelectorProps {
  transcription: TranscriptionResult | null
  currentTime: number
  duration: number
  onSelectRange: (startTime: number, endTime: number) => void
  onCancel: () => void
}

export function AudioRangeSelector({
  transcription,
  currentTime,
  duration,
  onSelectRange,
  onCancel,
}: AudioRangeSelectorProps) {
  const [rangeStart, setRangeStart] = useState(currentTime)
  const [rangeEnd, setRangeEnd] = useState(Math.min(currentTime + 5, duration))
  const [selectedWords, setSelectedWords] = useState<WordTimestamp[]>([])

  // Helper function to get the start time from a word
  const getStartTime = (word: WordTimestamp): number => {
    if (word.startTime !== undefined) return Number(word.startTime)
    if (word.start_time !== undefined) return Number(word.start_time)
    return 0
  }

  // Helper function to get the end time from a word
  const getEndTime = (word: WordTimestamp): number => {
    if (word.endTime !== undefined) return Number(word.endTime)
    if (word.end_time !== undefined) return Number(word.end_time)
    return 0
  }

  // Update selected words when range changes
  useEffect(() => {
    if (!transcription?.words) return

    const words = transcription.words.filter((word) => {
      const wordStart = getStartTime(word)
      return wordStart >= rangeStart && wordStart <= rangeEnd
    })

    setSelectedWords(words)
  }, [rangeStart, rangeEnd, transcription])

  const handleRangeChange = (values: number[]) => {
    const [start, end] = values
    setRangeStart(start)
    setRangeEnd(end)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Select Audio Range</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Start: {formatTime(rangeStart)}</span>
            <span>End: {formatTime(rangeEnd)}</span>
          </div>
          <Slider
            value={[rangeStart, rangeEnd]}
            min={0}
            max={duration}
            step={0.1}
            onValueChange={handleRangeChange}
            className="cursor-pointer"
          />
          <div className="text-sm text-muted-foreground">Duration: {formatTime(rangeEnd - rangeStart)}</div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected Words:</h4>
          <div className="bg-muted p-2 rounded-md max-h-[100px] overflow-y-auto">
            {selectedWords.length > 0 ? (
              <p className="text-sm">{selectedWords.map((word) => word.word).join(" ")}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No words selected</p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onSelectRange(rangeStart, rangeEnd)}
            className="flex items-center gap-1"
          >
            <VolumeX className="h-4 w-4" />
            Mute
          </Button>
          <Button onClick={() => onSelectRange(rangeStart, rangeEnd)} className="flex items-center gap-1">
            <Mic className="h-4 w-4" />
            Replace with TTS
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
