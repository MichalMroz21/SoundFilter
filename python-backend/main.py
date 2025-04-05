from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Optional
import uvicorn
import os
import pathlib

from audio.speech_processor import detect_phrase_in_audio, transcribe_audio

app = FastAPI(
    title="SoundFilter Audio API",
    description="API for detecting phrases in audio files",
    version="0.1.0"
)

# Create temp directory with absolute path
BASE_DIR = pathlib.Path(__file__).parent.absolute()
TEMP_DIR = os.path.join(BASE_DIR, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


# DO ALL ENTRYPOINTS AS "audio-api" ... slash something...
@app.get("/audio-api/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


@app.post("/audio-api/detect-phrase")
async def detect_phrase(
        audio_file: UploadFile = File(..., description="Audio file to analyze"),
        phrase: str = Form(..., description="Text phrase to detect in the audio"),
        language: str = Form("en-US", description="Language code (e.g., en-US, pl-PL)")
):
    """
    Detect a text phrase in an audio file and return timestamps where it occurs.
    """
    # Validate file type
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    # Save uploaded file temporarily with absolute path
    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        # Ensure temp directory exists
        os.makedirs(TEMP_DIR, exist_ok=True)

        # Save the file
        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        # Call the detection function
        result = detect_phrase_in_audio(temp_file_path, phrase, language)

        return {
            "filename": audio_file.filename,
            "phrase": phrase,
            "found": result["found"],
            "occurrences": result["occurrences"],
            "processing_time": result["processing_time"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.post("/audio-api/transcribe")
async def transcribe(
        audio_file: UploadFile = File(..., description="Audio file to transcribe"),
        language: str = Form("en-US", description="Language code (e.g., en-US, pl-PL)")
):
    """
    Transcribe an audio file and detect all words with their timestamps.
    """
    # Validate file type
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    # Save uploaded file temporarily with absolute path
    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        # Ensure temp directory exists
        os.makedirs(TEMP_DIR, exist_ok=True)

        # Save the file
        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        # Call the transcription function
        result = transcribe_audio(temp_file_path, language)

        return {
            "filename": audio_file.filename,
            "transcript": result["transcript"],
            "words": result["words"],
            "processing_time": result["processing_time"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.get("/audio-api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    print(f"Temporary directory created at: {TEMP_DIR}")
    uvicorn.run("main:app", host="0.0.0.0", port=8082, reload=True)

