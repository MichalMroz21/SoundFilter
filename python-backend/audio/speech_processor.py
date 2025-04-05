import time
from typing import Dict, List, Optional, Tuple
import wave
import contextlib
import re
import os
import tempfile
import whisper
import torch


def transcribe_audio(file_path: str, language: str = "en-US") -> Dict:
    start_time = time.time()

    result = {
        "transcript": "",
        "words": [],
        "processing_time": 0
    }

    try:
        whisper_language = language.split('-')[0]

        # Load Whisper model (choose size based on your needs: tiny, base, small, medium, large)
        model = whisper.load_model("base")

        # Check if file exists
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return result

        # Print file path for debugging
        print(f"Processing file: {file_path}")

        # Transcribe with word timestamps
        # Use absolute path to ensure file is found
        abs_file_path = os.path.abspath(file_path)
        print(f"Absolute file path: {abs_file_path}")

        transcription = model.transcribe(
            abs_file_path,
            language=whisper_language,
            word_timestamps=True,
            fp16=False
        )

        # Extract transcript
        result["transcript"] = transcription["text"]

        # Extract word timestamps
        if "segments" in transcription:
            for segment in transcription["segments"]:
                if "words" in segment:
                    for word_data in segment["words"]:
                        result["words"].append({
                            "word": word_data["word"],
                            "start_time": word_data["start"],
                            "end_time": word_data["end"],
                            "confidence": word_data.get("confidence", 0.9)
                        })

    except Exception as e:
        print(f"Error in transcribe_audio: {e}")
        import traceback
        traceback.print_exc()  # Print full traceback for debugging

    finally:
        # Calculate processing time
        result["processing_time"] = time.time() - start_time

    return result


def detect_phrase_in_audio(file_path: str, phrase: str, language: str = "en-US") -> Dict:
    """
    Detect a phrase in an audio file and return timestamps of occurrences using locally installed Whisper.

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
                    "end_time": float,
                    "confidence": float
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

            # Find phrase occurrences in aligned words
            occurrences = find_phrase_occurrences(words_with_times, phrase)
            result["occurrences"] = occurrences

    except Exception as e:
        print(f"Error in detect_phrase_in_audio: {e}")

    finally:
        # Calculate processing time
        result["processing_time"] = time.time() - start_time

    return result


def find_phrase_occurrences(words_with_times: List[Dict], phrase: str) -> List[Dict]:
    """
    Find occurrences of a phrase in aligned words.

    Args:
        words_with_times: List of words with timestamps
        phrase: Phrase to find

    Returns:
        List of phrase occurrences with timestamps
    """
    occurrences = []

    if not words_with_times:
        return occurrences

    # Convert phrase to lowercase and split into words
    phrase_words = phrase.lower().split()

    # Find occurrences of the phrase
    i = 0
    while i <= len(words_with_times) - len(phrase_words):
        match = True
        for j in range(len(phrase_words)):
            if i + j >= len(words_with_times) or words_with_times[i + j]["word"].lower().strip() != phrase_words[j]:
                match = False
                break

        if match:
            # Found a match, create an occurrence
            start_time = words_with_times[i]["start_time"]
            end_time = words_with_times[i + len(phrase_words) - 1]["end_time"]

            # Calculate average confidence
            confidence_sum = sum(words_with_times[i + j].get("confidence", 0.9) for j in range(len(phrase_words)))
            avg_confidence = confidence_sum / len(phrase_words)

            occurrences.append({
                "start_time": start_time,
                "end_time": end_time,
                "confidence": avg_confidence
            })

            # Skip to after this occurrence
            i += len(phrase_words)
        else:
            i += 1

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

