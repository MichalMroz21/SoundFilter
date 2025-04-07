from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, status
from typing import Optional, List, Dict
import uvicorn
import os
import pathlib

from audio.speech_processor import detect_phrase_in_audio, transcribe_audio
from audio.audio_modifier import modify_audio

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
    print(f"Received request for /audio-api/{name}")
    return {"message": f"Hello {name}"}


@app.post("/audio-api/detect-phrase")
async def detect_phrase(
        audio_file: UploadFile = File(..., description="Audio file to analyze"),
        phrase: str = Form(..., description="Text phrase to detect in the audio")
):
    """
    Detect a text phrase in an audio file and return timestamps where it occurs.
    Language is automatically detected by Whisper.
    """
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an audio file")

    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        os.makedirs(TEMP_DIR, exist_ok=True)

        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        result = detect_phrase_in_audio(temp_file_path, phrase)

        return {
            "filename": audio_file.filename,
            "phrase": phrase,
            "found": result["found"],
            "occurrences": result["occurrences"],
            "detected_language": result["detected_language"],
            "processing_time": result["processing_time"]
        }

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error processing audio: {str(e)}")

    finally:
        #Clean up the temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.post("/audio-api/transcribe")
async def transcribe(
        audio_file: UploadFile = File(..., description="Audio file to analyze")
):
    """
    Transcribe an audio file and detect all words with their timestamps.
    Language is automatically detected by Whisper.
    """
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an audio file")

    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        os.makedirs(TEMP_DIR, exist_ok=True)

        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        result = transcribe_audio(temp_file_path)

        return {
            "filename": audio_file.filename,
            "transcript": result["transcript"],
            "words": result["words"],
            "detected_language": result["detected_language"],
            "processing_time": result["processing_time"]
        }

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error processing audio: {str(e)}")

    finally:
        #Clean up the temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.post("/audio-api/modify")
async def modify_audio_endpoint(
        audio_file: UploadFile = File(..., description="Audio file to modify"),
        start_time: float = Form(..., description="Start time in seconds"),
        end_time: float = Form(..., description="End time in seconds"),
        modification_type: str = Form(..., description="Type of modification: 'mute' or 'tone'"),
        tone_frequency: Optional[int] = Form(440, description="Frequency of tone in Hz (only for 'tone' type)"),
        output_format: str = Form("wav", description="Output format (wav, mp3, etc.)")
):
    """
    Modify an audio file by applying a modification at the specified time range.
    """
    #Validate file type
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an audio file")

    #Validate modification type
    if modification_type not in ["mute", "tone"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Modification type must be 'mute' or 'tone'")

    #Validate time range
    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start time must be less than end time")

    #Save uploaded file temporarily
    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        os.makedirs(TEMP_DIR, exist_ok=True)

        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        file_bytes, content_type = modify_audio(
            temp_file_path,
            start_time,
            end_time,
            modification_type,
            tone_frequency,
            output_format
        )

        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="modified_{audio_file.filename}"'
            }
        )

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error modifying audio: {str(e)}")

    finally:
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
    uvicorn.run("main:app", host="0.0.0.0", port=8083)

