import librosa
import librosa.effects as effects
import soundfile as sf
import numpy as np
import os

def add_noise(audio_path, output_path, noise_level=0.05):
    y, sr = librosa.load(audio_path)
    noise = np.random.normal(0, noise_level, y.shape)
    y_noisy = y + noise
    sf.write(output_path, y_noisy, sr)

def add_echo(audio_path, output_path, delay=0.1, decay=0.3):
    y, sr = librosa.load(audio_path)
    delay_samples = int(delay * sr)
    echo = np.zeros_like(y)
    echo[delay_samples:] = y[:-delay_samples] * decay
    y_echo = y + echo
    sf.write(output_path, y_echo, sr)

def speed_up(audio_path, output_path, rate=1.5):
    y, sr = librosa.load(audio_path)
    y_fast = effects.time_stretch(y, rate=rate)
    sf.write(output_path, y_fast, sr)

def slow_down(audio_path, output_path, rate=0.75):
    y, sr = librosa.load(audio_path)
    y_slow = effects.time_stretch(y, rate=rate)
    sf.write(output_path, y_slow, sr)

path = "D:/SoundFilter/pilot_study/recorded/1-noise.mp4"

filename = os.path.basename(path)
name_without_ext = os.path.splitext(filename)[0]

output_dir1 = "D:/SoundFilter/pilot_study/alteredNoise/"
output_dir2 = "D:/SoundFilter/pilot_study/alteredEcho/"
output_dir3 = "D:/SoundFilter/pilot_study/alteredUp/"
output_dir4 = "D:/SoundFilter/pilot_study/alteredDown/"

for directory in [output_dir1, output_dir2, output_dir3, output_dir4]:
    os.makedirs(directory, exist_ok=True)

output_path1 = os.path.join(output_dir1, f"{name_without_ext}_noise.wav")
output_path2 = os.path.join(output_dir2, f"{name_without_ext}_echo.wav")
output_path3 = os.path.join(output_dir3, f"{name_without_ext}_fast.wav")
output_path4 = os.path.join(output_dir4, f"{name_without_ext}_slow.wav")

add_noise(path, output_path1)
add_echo(path, output_path2)
speed_up(path, output_path3)
slow_down(path, output_path4)

print(f"Created noise version: {output_path1}")
print(f"Created echo version: {output_path2}")
print(f"Created faster version: {output_path3}")
print(f"Created slower version: {output_path4}")