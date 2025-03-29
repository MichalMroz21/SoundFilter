import uvicorn
from fastapi import FastAPI
app = FastAPI()

@app.get("/audio-api/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8082)
