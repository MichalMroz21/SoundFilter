import whisper

model = whisper.load_model('base')
result = model.transcribe('harvard.wav', fp16=False)

print(result['text'])