from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, status
from typing import Optional, List, Dict
import uvicorn
import os
import pathlib
import threading

from audio.speech_processor import detect_phrase_in_audio, transcribe_audio
from audio.audio_modifier import modify_audio, replace_with_tts, load_tts_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=load_tts_model, daemon=True)
    thread.start()

    yield
    pass

app = FastAPI(
    title="SoundFilter Audio API",
    description="API for detecting phrases in audio files",
    version="0.1.0",
    lifespan=lifespan
)

BASE_DIR = pathlib.Path(__file__).parent.absolute()
TEMP_DIR = os.path.join(BASE_DIR, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/tts/status")
async def tts_status():
    from audio.audio_modifier import get_download_status
    return get_download_status()


@app.get("/audio-api/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


@app.post("/audio-api/detect-phrase")
async def detect_phrase(
        audio_file: UploadFile = File(..., description="Audio file to analyze"),
        phrase: str = Form(..., description="Text phrase to detect in the audio")
):
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error processing audio: {str(e)}")

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.post("/audio-api/transcribe")
async def transcribe(
        audio_file: UploadFile = File(..., description="Audio file to analyze")
):
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error processing audio: {str(e)}")

    finally:
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
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an audio file")

    if modification_type not in ["mute", "tone"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Modification type must be 'mute' or 'tone'")

    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start time must be less than end time")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error modifying audio: {str(e)}")

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@app.post("/audio-api/replace-with-tts")
async def replace_with_tts_endpoint(
    audio_file: UploadFile = File(..., description="Audio file to modify"),
    start_time: float = Form(..., description="Start time in seconds"),
    replacement_text: str = Form(..., description="Text to synthesize and insert"),
    output_format: str = Form("wav", description="Output format (wav, mp3, etc.)"),
    use_edge_tts: bool = Form(False, description="Whether to use Edge TTS (True) or Tortoise TTS (False)"),
    end_time: Optional[float] = Form(None, description="End time in seconds (optional)"),
    gender: Optional[str] = Form(None,
                                 description="Specify gender for TTS voice ('male' or 'female'). If not provided, it will be auto-detected.")
):
    from audio.audio_modifier import TTS_MODEL_LOADED

    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"File must be an audio file. Got content type: {audio_file.content_type}")

    if end_time is not None and start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Start time ({start_time}) must be less than end time ({end_time})")

    # Validate gender parameter if provided
    if gender is not None and gender.lower() not in ['male', 'female']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Gender must be either 'male' or 'female'. Got: {gender}")

    temp_file_path = os.path.join(TEMP_DIR, audio_file.filename)

    try:
        os.makedirs(TEMP_DIR, exist_ok=True)

        with open(temp_file_path, "wb") as buffer:
            content = await audio_file.read()
            buffer.write(content)

        # Call the async version of replace_with_tts
        file_bytes, content_type = await replace_with_tts(
            temp_file_path,
            start_time,
            replacement_text,
            output_format,
            use_edge_tts,
            "fast",  # preset
            2,  # max_retries
            end_time,
            gender.lower() if gender else None  # Pass the gender parameter
        )

        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="tts_replaced_{audio_file.filename}"'
            }
        )

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error replacing audio with TTS: {e}\n{error_details}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error replacing audio with TTS: {str(e)}")

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")

@app.get("/audio-api/health")
async def health_check():
    from audio.audio_modifier import TTS_MODEL_LOADED
    return {
        "status": "healthy",
        "tts_model_loaded": TTS_MODEL_LOADED
    }


@app.get("/audio-api/tts-status")
async def tts_status():
    from audio.audio_modifier import TTS_MODEL_LOADED
    return {
        "tts_model_loaded": TTS_MODEL_LOADED
    }


if __name__ == "__main__":
    print(f"Temporary directory created at: {TEMP_DIR}")
    uvicorn.run("main:app", host="0.0.0.0", port=8083)