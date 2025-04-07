export interface TranscriptionResult {
    filename: string
    transcript: string
    words: WordTimestamp[]
    detectedLanguage: string | null
    processingTime: number
  }
  
  export interface WordTimestamp {
    word: string
    // Support multiple possible property names for timestamps
    startTime?: number | string
    endTime?: number | string
    start_time?: number | string // Snake case alternative
    end_time?: number | string // Snake case alternative
  }
  
  