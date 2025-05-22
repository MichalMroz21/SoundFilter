import os
import numpy as np
from pydub import AudioSegment
import io
from typing import Dict, Optional, Tuple, List
import tempfile
import torch
import librosa
import soundfile as sf
from scipy import signal
import time

from audio.speech_processor import transcribe_audio

TTS_MODEL_LOADED = False
TTS_MODEL = None


def load_tts_model():
    global TTS_MODEL_LOADED, TTS_MODEL

    if not TTS_MODEL_LOADED:
        try:
            print("Loading Tortoise TTS model...")
            from tortoise.api import TextToSpeech
            TTS_MODEL = TextToSpeech()
            test_text = "This is a test."
            _ = TTS_MODEL.tts(test_text, voice_samples=None)
            TTS_MODEL_LOADED = True
            print("Tortoise TTS model loaded successfully!")
        except Exception as e:
            print(f"Error loading Tortoise TTS model: {e}")
            import traceback
            traceback.print_exc()


def modify_audio(
        file_path: str,
        start_time: float,
        end_time: float,
        modification_type: str,
        tone_frequency: int = 440,
        output_format: str = "wav"
) -> Tuple[bytes, str]:
    try:
        audio = AudioSegment.from_file(file_path)
        start_ms = int(start_time * 1000)
        end_ms = int(end_time * 1000)

        if start_ms < 0:
            start_ms = 0
        if end_ms > len(audio):
            end_ms = len(audio)
        if end_ms <= start_ms:
            raise ValueError("End time must be greater than start time")

        segment_duration = end_ms - start_ms

        if modification_type == "mute":
            modified_segment = AudioSegment.silent(duration=segment_duration, frame_rate=audio.frame_rate)
        elif modification_type == "tone":
            frequency = tone_frequency
            sample_rate = audio.frame_rate
            channels = audio.channels
            num_samples = int(segment_duration / 1000 * sample_rate)
            t = np.linspace(0, segment_duration / 1000, num_samples, endpoint=False)
            samples = np.sin(2 * np.pi * frequency * t)

            fade_duration = min(50, segment_duration // 4)
            if fade_duration > 0:
                fade_samples = int(fade_duration / 1000 * sample_rate)
                fade_in = np.linspace(0, 1, fade_samples)
                fade_out = np.linspace(1, 0, fade_samples)
                samples[:fade_samples] *= fade_in
                samples[-fade_samples:] *= fade_out

            samples = (samples * 32767).astype(np.int16)
            if channels > 1:
                multi_channel_samples = np.zeros((num_samples, channels), dtype=np.int16)
                for i in range(channels):
                    multi_channel_samples[:, i] = samples
                samples = multi_channel_samples.flatten()

            modified_segment = AudioSegment(
                samples.tobytes(),
                frame_rate=sample_rate,
                sample_width=2,
                channels=channels
            )

            if len(modified_segment) != segment_duration:
                if len(modified_segment) < segment_duration:
                    modified_segment += AudioSegment.silent(duration=segment_duration - len(modified_segment),
                                                            frame_rate=sample_rate)
                else:
                    modified_segment = modified_segment[:segment_duration]

            original_segment = audio[start_ms:end_ms]
            if len(original_segment) > 0 and original_segment.dBFS > -float('inf'):
                try:
                    modified_segment = modified_segment.apply_gain(
                        original_segment.dBFS - modified_segment.dBFS
                    )
                except Exception:
                    pass
        else:
            raise ValueError(f"Unknown modification type: {modification_type}")

        audio = audio[:start_ms] + modified_segment + audio[end_ms:]
        buffer = io.BytesIO()
        audio.export(buffer, format=output_format)
        buffer.seek(0)

        content_type = f"audio/{output_format}"
        if output_format == "mp3":
            content_type = "audio/mpeg"

        return buffer.read(), content_type

    except Exception as e:
        print(f"Error modifying audio: {e}")
        import traceback
        traceback.print_exc()
        raise


def detect_gender_from_audio(file_path: str) -> str:
    """
    Detect speaker gender using Whisper or Tortoise AI models.
    Falls back to acoustic analysis if AI detection fails.
    """
    try:
        # First try to use Whisper directly
        try:
            import whisper
            model = whisper.load_model("base")
            # Some Whisper models can provide speaker characteristics
            result = model.transcribe(file_path)

            # Check if Whisper provides speaker gender info
            if hasattr(result, "speaker_characteristics") and "gender" in result.speaker_characteristics:
                return result.speaker_characteristics["gender"]
        except Exception as e:
            print(f"Whisper gender detection failed: {e}")

        # Try using Tortoise voice analysis if available
        if TTS_MODEL_LOADED:
            try:
                from tortoise.utils.audio import load_audio
                audio_data = load_audio(file_path, 24000)

                # Some versions of Tortoise have speaker analysis capabilities
                if hasattr(TTS_MODEL, "analyze_voice"):
                    voice_analysis = TTS_MODEL.analyze_voice(audio_data)
                    if "gender_prob" in voice_analysis:
                        return "female" if voice_analysis["gender_prob"] > 0.5 else "male"
            except Exception as e:
                print(f"Tortoise gender detection failed: {e}")

        # Fall back to acoustic analysis
        y, sr = librosa.load(file_path, sr=None)

        # Extract pitch (fundamental frequency)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)

        # Get the mean pitch where magnitude is significant
        significant_pitches = []
        for i in range(magnitudes.shape[1]):
            index = magnitudes[:, i].argmax()
            pitch = pitches[index, i]
            if pitch > 0 and magnitudes[index, i] > 0.1:
                significant_pitches.append(pitch)

        if not significant_pitches:
            return "male"  # Default to male if no pitches detected

        mean_pitch = np.mean(significant_pitches)

        # Lower threshold for male detection - typical male voice: 85-155 Hz
        # Female voice typically: 165-255 Hz
        if mean_pitch < 155:
            return "male"
        else:
            # Additional check for lower frequencies
            low_freq_energy = np.sum(np.abs(librosa.stft(y)[:20, :]))
            high_freq_energy = np.sum(np.abs(librosa.stft(y)[20:100, :]))

            # Males typically have more energy in lower frequencies
            if low_freq_energy > high_freq_energy * 1.2:
                return "male"
            else:
                return "female"
    except Exception as e:
        print(f"Error detecting gender: {e}")
        return "male"  # Default to male on error


def load_audio_for_tortoise(file_path: str) -> List[torch.Tensor]:
    try:
        from tortoise.utils.audio import load_audio
        audio_data = load_audio(file_path, 24000)
        if TTS_MODEL and hasattr(TTS_MODEL, 'device'):
            audio_data = audio_data.to(TTS_MODEL.device)
        return [audio_data]
    except Exception as e:
        print(f"Error loading audio for Tortoise: {e}")
        try:
            audio, sr = librosa.load(file_path, sr=24000)
            audio_tensor = torch.FloatTensor(audio)
            if len(audio_tensor.shape) > 1:
                audio_tensor = audio_tensor.mean(dim=0)
            if audio_tensor.abs().max() > 1.0:
                audio_tensor = audio_tensor / audio_tensor.abs().max()
            audio_tensor = audio_tensor.unsqueeze(0)
            if TTS_MODEL and hasattr(TTS_MODEL, 'device'):
                audio_tensor = audio_tensor.to(TTS_MODEL.device)
            return [audio_tensor]
        except Exception as fallback_error:
            print(f"Fallback audio loading also failed: {fallback_error}")
            raise


def generate_tts(
        text: str,
        voice_sample_path: Optional[str] = None,
        output_path: Optional[str] = None,
        output_format: str = "wav",
        language: str = "en",
        preset: str = "fast"
) -> str:
    global TTS_MODEL, TTS_MODEL_LOADED

    try:
        if not TTS_MODEL_LOADED:
            print("TTS model not loaded yet, loading now...")
            load_tts_model()

        if not TTS_MODEL_LOADED:
            raise Exception("Failed to load Tortoise TTS model")

        if output_path is None:
            output_path = tempfile.mktemp(suffix=f".{output_format}")

        voice_samples = None
        if voice_sample_path:
            voice_samples = load_audio_for_tortoise(voice_sample_path)

        try:
            if preset == "ultra_fast":
                gen_audio = TTS_MODEL.tts(
                    text=text,
                    voice_samples=voice_samples,
                    k=1,
                    diffusion_iterations=30,
                    cond_free=False
                )
            elif preset == "fast":
                gen_audio = TTS_MODEL.tts(
                    text=text,
                    voice_samples=voice_samples,
                    k=1,
                    diffusion_iterations=50
                )
            elif preset == "standard":
                gen_audio = TTS_MODEL.tts(
                    text=text,
                    voice_samples=voice_samples,
                    k=2,
                    diffusion_iterations=100
                )
            elif preset == "high_quality":
                gen_audio = TTS_MODEL.tts(
                    text=text,
                    voice_samples=voice_samples,
                    k=6,
                    diffusion_iterations=200
                )
            else:
                gen_audio = TTS_MODEL.tts(
                    text=text,
                    voice_samples=voice_samples
                )
        except Exception as e:
            print(f"Error in Tortoise TTS generation: {e}")
            import traceback
            traceback.print_exc()
            raise

        audio_np = gen_audio.cpu().numpy()
        if len(audio_np.shape) > 2:
            audio_np = audio_np.squeeze()
            if len(audio_np.shape) > 1:
                audio_np = audio_np[0]

        sf.write(output_path, audio_np, 24000)

        if output_format != "wav":
            temp_wav_path = output_path
            output_path = output_path.replace(".wav", f".{output_format}")
            audio = AudioSegment.from_wav(temp_wav_path)
            audio.export(output_path, format=output_format)
            try:
                os.remove(temp_wav_path)
            except Exception:
                pass

        return output_path

    except Exception as e:
        print(f"Error generating TTS with Tortoise: {e}")
        import traceback
        traceback.print_exc()
        raise


async def generate_edge_tts(
        text: str,
        output_path: str,
        language: str = "en",
        gender: str = "female"
) -> str:
    """
    Generate speech using Edge TTS with gender selection.

    Args:
        text: Text to synthesize
        output_path: Path to save the audio file
        language: Language code (e.g., 'en', 'fr', 'es')
        gender: 'male' or 'female'

    Returns:
        Path to the generated audio file
    """
    try:
        import edge_tts

        # Map language code to Edge TTS voice
        # Default voices for common languages
        voice_map = {
            'en': {
                'male': 'en-US-GuyNeural',
                'female': 'en-US-JennyNeural'
            },
            'es': {
                'male': 'es-ES-AlvaroNeural',
                'female': 'es-ES-ElviraNeural'
            },
            'fr': {
                'male': 'fr-FR-HenriNeural',
                'female': 'fr-FR-DeniseNeural'
            },
            'de': {
                'male': 'de-DE-ConradNeural',
                'female': 'de-DE-KatjaNeural'
            },
            'it': {
                'male': 'it-IT-DiegoNeural',
                'female': 'it-IT-ElsaNeural'
            },
            'ja': {
                'male': 'ja-JP-KeitaNeural',
                'female': 'ja-JP-NanamiNeural'
            },
            'ko': {
                'male': 'ko-KR-InJoonNeural',
                'female': 'ko-KR-SunHiNeural'
            },
            'pt': {
                'male': 'pt-BR-AntonioNeural',
                'female': 'pt-BR-FranciscaNeural'
            },
            'ru': {
                'male': 'ru-RU-DmitryNeural',
                'female': 'ru-RU-SvetlanaNeural'
            },
            'zh': {
                'male': 'zh-CN-YunxiNeural',
                'female': 'zh-CN-XiaoxiaoNeural'
            },
            'zh-cn': {
                'male': 'zh-CN-YunxiNeural',
                'female': 'zh-CN-XiaoxiaoNeural'
            },
            'zh-tw': {
                'male': 'zh-TW-YunJheNeural',
                'female': 'zh-TW-HsiaoChenNeural'
            }
        }

        # Get the base language code (e.g., 'en' from 'en-US')
        base_lang = language.split('-')[0] if '-' in language else language

        # Select voice based on gender and language
        if base_lang in voice_map and gender.lower() in voice_map[base_lang]:
            voice = voice_map[base_lang][gender.lower()]
        elif base_lang in voice_map:
            # If specific gender not available, use any voice for that language
            voice = list(voice_map[base_lang].values())[0]
        else:
            # Default to English if language not supported
            voice = voice_map['en'][gender.lower()]

        print(f"Using Edge TTS with voice: {voice}")

        # Generate speech
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)

        return output_path

    except Exception as e:
        print(f"Error generating speech with Edge TTS: {e}")
        import traceback
        traceback.print_exc()
        raise


async def replace_with_tts(
        file_path: str,
        start_time: float,
        replacement_text: str,
        output_format: str = "wav",
        use_edge_tts: bool = False,
        preset: str = "fast",
        max_retries: int = 2,
        end_time: Optional[float] = None,
        gender: Optional[str] = None
) -> Tuple[bytes, str]:
    try:
        audio = AudioSegment.from_file(file_path)
        start_ms = int(start_time * 1000)

        # Calculate target duration if end_time is provided
        target_duration_ms = None
        if end_time is not None:
            end_ms = int(end_time * 1000)
            if start_ms < 0:
                start_ms = 0
            if end_ms > len(audio):
                end_ms = len(audio)
            if end_ms <= start_ms:
                raise ValueError("End time must be greater than start time")

            # Calculate the exact duration we need to fit
            target_duration_ms = end_ms - start_ms
        else:
            end_ms = None  # Will be determined by TTS duration

        # First, try to get language from Whisper
        try:
            transcription_result = transcribe_audio(file_path)
            detected_lang = transcription_result.get("detected_language", "en")
        except Exception:
            detected_lang = 'en'

        with tempfile.TemporaryDirectory() as temp_dir:
            tts_audio = None

            # Try Tortoise TTS if not using Edge TTS
            if not use_edge_tts:
                if not TTS_MODEL_LOADED:
                    print("TTS model not loaded yet, loading now...")
                    load_tts_model()

                if TTS_MODEL_LOADED:
                    try:
                        # Use the entire audio file for voice cloning
                        voice_sample_path = None
                        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                            audio.export(temp_file.name, format="wav")
                            voice_sample_path = temp_file.name

                        tts_output_path = os.path.join(temp_dir, f"tts_output.{output_format}")

                        output_path = generate_tts(
                            replacement_text,
                            voice_sample_path=voice_sample_path,
                            output_path=tts_output_path,
                            output_format=output_format,
                            language=detected_lang,
                            preset=preset
                        )

                        tts_audio = AudioSegment.from_file(output_path)

                        # Clean up voice sample file
                        if voice_sample_path and os.path.exists(voice_sample_path):
                            try:
                                os.remove(voice_sample_path)
                            except Exception:
                                pass

                    except Exception as e:
                        print(f"Tortoise TTS failed: {e}")
                        tts_audio = None
                else:
                    print("Tortoise TTS model not loaded, falling back to Edge TTS")
                    tts_audio = None

            # Use Edge TTS if specified or if Tortoise failed
            if tts_audio is None:
                # Use provided gender or detect it
                speaker_gender = gender
                if speaker_gender is None:
                    speaker_gender = detect_gender_from_audio(file_path)
                print(f"Using gender for Edge TTS: {speaker_gender}")

                # Generate TTS audio using Edge TTS
                tts_output_path = os.path.join(temp_dir, f"tts_output.mp3")

                try:
                    # Directly await the async function
                    output_path = await generate_edge_tts(
                        replacement_text,
                        tts_output_path,
                        language=detected_lang,
                        gender=speaker_gender
                    )

                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        tts_audio = AudioSegment.from_file(output_path)
                        print(f"Used edge-tts with {speaker_gender} voice")
                    else:
                        raise Exception("edge-tts failed to create audio file")

                except Exception as e:
                    print(f"Edge TTS failed: {e}")
                    raise  # Re-raise the exception since we don't have another fallback

            # Fit TTS to target duration if specified
            if end_time is not None and target_duration_ms is not None:
                tts_duration_ms = len(tts_audio)

                if tts_duration_ms != target_duration_ms:
                    # Calculate time stretch factor
                    stretch_factor = tts_duration_ms / target_duration_ms
                    print(
                        f"Adjusting TTS duration: {tts_duration_ms}ms → {target_duration_ms}ms (factor: {stretch_factor:.2f})")

                    # Time-stretch the audio to fit exactly
                    temp_wav = os.path.join(temp_dir, "temp_for_stretch.wav")
                    tts_audio.export(temp_wav, format="wav")

                    y, sr = librosa.load(temp_wav, sr=None)
                    y_stretched = librosa.effects.time_stretch(y, rate=stretch_factor)

                    # Save the stretched audio
                    stretched_path = os.path.join(temp_dir, f"tts_stretched.wav")
                    sf.write(stretched_path, y_stretched, sr)

                    # Load the stretched audio
                    tts_audio = AudioSegment.from_file(stretched_path)

                    # Verify the duration is correct
                    actual_duration = len(tts_audio)
                    if abs(actual_duration - target_duration_ms) > 10:  # Allow 10ms tolerance
                        print(f"Fine-tuning duration: {actual_duration}ms → {target_duration_ms}ms")
                        # Fine-tune by trimming or padding if needed
                        if actual_duration > target_duration_ms:
                            tts_audio = tts_audio[:target_duration_ms]
                        else:
                            silence = AudioSegment.silent(duration=target_duration_ms - actual_duration,
                                                          frame_rate=tts_audio.frame_rate)
                            tts_audio = tts_audio + silence

            # If end_time was not provided, determine it based on TTS duration
            if end_ms is None:
                end_ms = start_ms + len(tts_audio)

            # Get the original segment for volume matching
            original_segment = audio[start_ms:end_ms]

            # Adjust volume
            if len(original_segment) > 0 and original_segment.dBFS > -float('inf'):
                try:
                    tts_audio = tts_audio.apply_gain(original_segment.dBFS - tts_audio.dBFS)
                except Exception:
                    pass

            # Replace segment in original audio
            modified_audio = audio[:start_ms] + tts_audio + audio[end_ms:]

            # Export modified audio
            buffer = io.BytesIO()
            modified_audio.export(buffer, format=output_format)
            buffer.seek(0)

            content_type = f"audio/{output_format}"
            if output_format == "mp3":
                content_type = "audio/mpeg"

            return buffer.read(), content_type

    except Exception as e:
        print(f"Error replacing audio with TTS: {e}")
        import traceback
        traceback.print_exc()
        raise


def get_download_status():
    return {"status": "ready" if TTS_MODEL_LOADED else "not loaded"}