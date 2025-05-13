import os
import csv
import pandas as pd
import whisper
import torch


def find_phrase_occurrences(transcript, phrase, words_with_times):
    occurrences = []

    if not transcript or not phrase or not words_with_times:
        return occurrences

    transcript_lower = transcript.lower()
    phrase_lower = phrase.lower()

    all_words = []

    for i, word_data in enumerate(words_with_times):
        word = word_data["word"].lower()
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

    all_words.sort(key=lambda x: x["pos"])

    start_pos = 0

    while True:
        pos = transcript_lower.find(phrase_lower, start_pos)

        if pos == -1:
            break

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


def find_audio_file(audio_dir, filename):
    full_path = os.path.join(audio_dir, filename)
    if os.path.exists(full_path):
        return full_path

    base_name = os.path.splitext(filename)[0]
    for ext in ['.wav', '.mp3', '.mp4', '.m4a', '.flac', '.ogg']:
        potential_file = os.path.join(audio_dir, base_name + ext)
        if os.path.exists(potential_file):
            return potential_file

    for file in os.listdir(audio_dir):
        if file.lower().startswith(base_name.lower()):
            return os.path.join(audio_dir, file)

    return None


def detect_phrases_in_audio(annotations_csv, audio_dir, output_csv, model_sizes=["tiny", "large"]):
    cuda_available = torch.cuda.is_available()
    device = torch.device("cuda" if cuda_available else "cpu")

    print(f"Using device: {device}")

    annotations = pd.read_csv(annotations_csv)

    print(f"Loaded {len(annotations)} annotations")

    grouped_annotations = annotations.groupby('audio_file')

    all_detections = []

    for model_size in model_sizes:
        print(f"\nLoading Whisper {model_size} model...")

        model = whisper.load_model(model_size, device=device)

        for audio_file, file_annotations in grouped_annotations:
            # Find the audio file with any extension
            file_path = find_audio_file(audio_dir, audio_file)

            if not file_path:
                print(f"Warning: File not found: {audio_file} (tried multiple extensions)")
                continue

            print(f"Processing {os.path.basename(file_path)} with {model_size} model...")

            try:
                transcription = model.transcribe(
                    file_path,
                    word_timestamps=True,
                    fp16=(device.type == "cuda")
                )

                transcript = transcription["text"]

                print(f"Transcript: {transcript}")

                words_with_times = []

                if "segments" in transcription:
                    for segment in transcription["segments"]:
                        if "words" in segment:
                            for word_data in segment["words"]:
                                words_with_times.append({
                                    "word": word_data["word"],
                                    "start_time": word_data["start"],
                                    "end_time": word_data["end"]
                                })

                for _, annotation in file_annotations.iterrows():
                    phrase = annotation['phrase'].lower()

                    occurrences = find_phrase_occurrences(transcript, phrase, words_with_times)

                    for occurrence in occurrences:
                        all_detections.append({
                            "model": model_size,
                            "audio_file": audio_file,
                            "phrase": phrase,
                            "detected_start": occurrence["start_time"],
                            "detected_end": occurrence["end_time"],
                            "ground_truth_start": annotation['start_time'],
                            "ground_truth_end": annotation['end_time'],
                            "transcript": transcript
                        })

                    if not occurrences:
                        all_detections.append({
                            "model": model_size,
                            "audio_file": audio_file,
                            "phrase": phrase,
                            "detected_start": "",
                            "detected_end": "",
                            "ground_truth_start": annotation['start_time'],
                            "ground_truth_end": annotation['end_time'],
                            "transcript": transcript
                        })

                    print(f"  Phrase '{phrase}' in {os.path.basename(file_path)}: {len(occurrences)} detections")

            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                import traceback
                traceback.print_exc()

        if cuda_available:
            torch.cuda.empty_cache()

    detections_df = pd.DataFrame(all_detections)
    detections_df.to_csv(output_csv, index=False)

    print(f"\nSaved all detections to {output_csv}")


if __name__ == "__main__":
    annotations_csv = "D:/SoundFilter/pilot_study_test_run/annotations.csv"
    audio_dir = "D:/SoundFilter/pilot_study_test_run"
    output_csv = "D:/SoundFilter/pilot_study/whisper_detections_transcripts.csv"

    detect_phrases_in_audio(annotations_csv, audio_dir, output_csv, ["tiny", "large"])