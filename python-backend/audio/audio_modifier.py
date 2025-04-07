import os
import numpy as np
from pydub import AudioSegment
import io
from typing import Dict, Optional, Tuple


def modify_audio(
        file_path: str,
        start_time: float,
        end_time: float,
        modification_type: str,
        tone_frequency: int = 440,
        output_format: str = "wav"
) -> Tuple[bytes, str]:
    """
    Modify an audio file by applying a modification at the specified time range.

    Args:
        file_path: Path to the input audio file
        start_time: Start time in seconds
        end_time: End time in seconds
        modification_type: Type of modification ("mute" or "tone")
        tone_frequency: Frequency of tone in Hz (only for "tone" type)
        output_format: Format of the output file (wav, mp3, etc.)

    Returns:
        Tuple of (file_bytes, content_type)
    """
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

            #Calculate number of samples needed for the exact duration
            num_samples = int(segment_duration / 1000 * sample_rate)

            #Generate time array for the exact duration
            t = np.linspace(0, segment_duration / 1000, num_samples, endpoint=False)

            #Generate sine wave
            samples = np.sin(2 * np.pi * frequency * t)

            #Apply fade in/out to avoid clicks
            fade_duration = min(50, segment_duration // 4)  # 50ms fade or 1/4 of segment, whichever is smaller

            if fade_duration > 0:
                fade_samples = int(fade_duration / 1000 * sample_rate)
                fade_in = np.linspace(0, 1, fade_samples)
                fade_out = np.linspace(1, 0, fade_samples)

                samples[:fade_samples] *= fade_in
                samples[-fade_samples:] *= fade_out

            #Convert to 16-bit PCM
            samples = (samples * 32767).astype(np.int16)

            #For multi-channel audio, duplicate the samples for each channel
            if channels > 1:
                multi_channel_samples = np.zeros((num_samples, channels), dtype=np.int16)
                for i in range(channels):
                    multi_channel_samples[:, i] = samples
                samples = multi_channel_samples.flatten()

            modified_segment = AudioSegment(
                samples.tobytes(),
                frame_rate=sample_rate,
                sample_width=2,  # 16-bit
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