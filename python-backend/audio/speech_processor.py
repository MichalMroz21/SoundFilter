import time
from typing import Dict, List, Optional
import wave
import contextlib
import re
import os
import whisper
import torch

# Check if CUDA is available
CUDA_AVAILABLE = torch.cuda.is_available()
if CUDA_AVAILABLE:
    print(f"CUDA is available. Using GPU for Whisper.")
    DEVICE = torch.device("cuda")
else:
    print(f"CUDA is not available. Using CPU for Whisper.")
    DEVICE = torch.device("cpu")

print("Loading Whisper model...")
MODEL = whisper.load_model("base")

#Move model to GPU if CUDA is available
if CUDA_AVAILABLE:
    MODEL = MODEL.to(DEVICE)
    print("Model moved to GPU")


def transcribe_audio(file_path: str, language: str = "en-US") -> Dict:
    """
    Transcribe an audio file and detect all words with their timestamps using Whisper.

    Args:
        file_path: Path to the audio file
        language: Language code for speech recognition

    Returns:
        Dictionary containing transcription results:
        {
            "transcript": str,
            "words": [
                {
                    "word": str,
                    "start_time": float,
                    "end_time": float
                },
                ...
            ],
            "processing_time": float
        }
    """
    start_time = time.time()

    result = {
        "transcript": "",
        "words": [],
        "processing_time": 0
    }

    try:
        whisper_language = language.split('-')[0]

        #Check if file exists
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return result

        #Print file path for debugging
        print(f"Processing file: {file_path}")

        #Transcribe with word timestamps using the global model
        transcription = MODEL.transcribe(
            file_path,
            language=whisper_language,
            word_timestamps=True,
            fp16=CUDA_AVAILABLE  #Use FP16 only if CUDA is available
        )

        #Extract transcript
        result["transcript"] = transcription["text"]

        #Extract word timestamps
        if "segments" in transcription:
            for segment in transcription["segments"]:
                if "words" in segment:
                    for word_data in segment["words"]:
                        result["words"].append({
                            "word": word_data["word"],
                            "start_time": word_data["start"],
                            "end_time": word_data["end"]
                        })

    except Exception as e:
        print(f"Error in transcribe_audio: {e}")
        import traceback
        traceback.print_exc()

    finally:
        #Calculate processing time
        result["processing_time"] = time.time() - start_time

        #Clear CUDA cache if using GPU
        if CUDA_AVAILABLE:
            torch.cuda.empty_cache()

    return result


def detect_phrase_in_audio(file_path: str, phrase: str, language: str = "en-US") -> Dict:
    """
    Detect a phrase in an audio file and return timestamps of occurrences using Whisper.

    Args:
        file_path: Path to the audio file
        phrase: Text phrase to detect
        language: Language code for speech recognition

    Returns:
        Dictionary containing detection results:
        {
            "found": bool,
            "occurrences": [
                {
                    "start_time": float,
                    "end_time": float
                },
                ...
            ],
            "processing_time": float
        }
    """
    start_time = time.time()

    # Initialize result structure
    result = {
        "found": False,
        "occurrences": [],
        "processing_time": 0
    }

    try:
        # Get transcript with word timestamps using Whisper
        transcription_result = transcribe_audio(file_path, language)
        transcript = transcription_result["transcript"]
        words_with_times = transcription_result["words"]

        # Print for debugging
        print(f"Transcript: {transcript}")
        print(f"Searching for phrase: {phrase}")

        # Check if phrase is in transcript (case-insensitive)
        if transcript and phrase.lower() in transcript.lower():
            result["found"] = True

            # Find phrase occurrences
            occurrences = find_phrase_occurrences(transcript, phrase, words_with_times)
            result["occurrences"] = occurrences

    except Exception as e:
        print(f"Error in detect_phrase_in_audio: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Calculate processing time
        result["processing_time"] = time.time() - start_time

    return result


def find_phrase_occurrences(transcript: str, phrase: str, words_with_times: List[Dict]) -> List[Dict]:
    """
    Find occurrences of a phrase in the transcript and map to word timestamps.

    Args:
        transcript: Full transcript text
        phrase: Phrase to find
        words_with_times: List of words with timestamps

    Returns:
        List of phrase occurrences with timestamps
    """
    occurrences = []

    if not transcript or not phrase or not words_with_times:
        return occurrences

    # Convert to lowercase for case-insensitive matching
    transcript_lower = transcript.lower()
    phrase_lower = phrase.lower()

    # Create a list of all words with their positions in the transcript
    all_words = []
    for i, word_data in enumerate(words_with_times):
        word = word_data["word"].lower()
        # Find all occurrences of this word in the transcript
        start_pos = 0
        while True:
            pos = transcript_lower.find(word, start_pos)
            if pos == -1:
                break
            all_words.append({
                "word": word,
                "pos": pos,
                "end_pos": pos + len(word),
                "index": i,
                "start_time": word_data["start_time"],
                "end_time": word_data["end_time"]
            })
            start_pos = pos + 1

    # Sort words by their position in the transcript
    all_words.sort(key=lambda x: x["pos"])

    # Find all occurrences of the phrase in the transcript
    start_pos = 0
    while True:
        pos = transcript_lower.find(phrase_lower, start_pos)
        if pos == -1:
            break

        # Find the words that overlap with this phrase occurrence
        phrase_end_pos = pos + len(phrase_lower)
        overlapping_words = [w for w in all_words if w["end_pos"] > pos and w["pos"] < phrase_end_pos]

        if overlapping_words:
            start_time = min(w["start_time"] for w in overlapping_words)
            end_time = max(w["end_time"] for w in overlapping_words)

            occurrences.append({
                "start_time": start_time,
                "end_time": end_time
            })

        start_pos = pos + 1

    return occurrences


def get_audio_duration(file_path: str) -> Optional[float]:
    """
    Get the duration of an audio file in seconds.
    """
    try:
        with contextlib.closing(wave.open(file_path, 'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            duration = frames / float(rate)
            return duration
    except Exception as e:
        print(f"Error getting audio duration: {e}")
        return None

