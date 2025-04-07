To run:
- go into infrastructure and
```
docker compose up -d
```
This will run database, email server and caddy reverse proxy.

- import postman file(s) into postman to test requests

- install node.js, in vscode, in frontend run
```
npm run dev
```
- in intellij run app (after doing docker).

```
For running python backend install:
python 3.9.9
pytorch GPU version with CUDA 11.8
CUDA 11.8 Toolkit
FFMpeg with .exes in env variable
Finally install OpenAI's whisper:
```
pip install setuptools-rust
pip install git+https://github.com/openai/whisper.git
```
Then in pycharm install dependencies and You can run main.py (run current file)
