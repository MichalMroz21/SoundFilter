"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, VolumeX, Mic } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import httpClient from "@/lib/httpClient"
import { formatTime, safeParseFloat } from "@/lib/utils"
import type { WordTimestamp } from "@/models/audio/TranscriptionResult"

// Define the new simplified response type
interface AudioModificationResponse {
  projectId: number;
  audioUrl: string;
}

interface AudioModificationOptionsProps {
  projectId: number
  selectedWord: WordTimestamp
  onModificationComplete: (newAudioUrl?: string) => Promise<void>
  onClose: () => void
}

export function AudioModificationOptions({
  projectId,
  selectedWord,
  onModificationComplete,
  onClose,
}: AudioModificationOptionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationType, setModificationType] = useState<"mute" | "tts">("mute")
  const [replacementText, setReplacementText] = useState(selectedWord.word)
  const [useEdgeTts, setUseEdgeTts] = useState(true)
  const [gender, setGender] = useState<"male" | "female">("male")

  // Helper function to get the start time from a word, handling different property names
  const getStartTime = (word: WordTimestamp): number => {
    if (word.startTime !== undefined) return safeParseFloat(word.startTime)
    if (word.start_time !== undefined) return safeParseFloat(word.start_time)
    return 0
  }

  // Helper function to get the end time from a word, handling different property names
  const getEndTime = (word: WordTimestamp): number => {
    if (word.endTime !== undefined) return safeParseFloat(word.endTime)
    if (word.end_time !== undefined) return safeParseFloat(word.end_time)
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

      const response = await httpClient.post<AudioModificationResponse>(`/api/audio/${projectId}/mute-audio`, null, {
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

      const response = await httpClient.post<AudioModificationResponse>(`/api/audio/${projectId}/replace-with-tts`, null, {
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