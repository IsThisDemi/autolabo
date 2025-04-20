from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import whisper
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Ollama API URL (default is localhost:11434)
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "mistral")

# Initialize Whisper model (using 'tiny' for faster results, can be changed to 'base', 'small', 'medium', or 'large')
# For production, you might want to use 'small' or 'medium' for better accuracy
print("Loading Whisper model...")
model = whisper.load_model("small")
print("Whisper model loaded!")

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    # Save uploaded file to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    file.save(temp_file.name)
    temp_file.close()
    
    try:
        # Transcribe the audio file using Whisper
        print(f"Transcribing file: {temp_file.name}")
        result = model.transcribe(temp_file.name)
        transcript = result["text"]
        
        # Clean up the temporary file
        os.unlink(temp_file.name)
        
        return jsonify({"transcript": transcript})
    
    except Exception as e:
        # Clean up the temporary file in case of error
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        
        print(f"Error during transcription: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    data = request.json
    
    if not data or 'transcript' not in data:
        return jsonify({"error": "No transcript provided"}), 400
    
    transcript = data['transcript']
    
    # Prepare the prompt for the LLM
    prompt = f"""
Tu sei un assistente specializzato nella creazione di relazioni di laboratorio strutturate.
Sulla base della seguente trascrizione di una registrazione audio, crea una relazione di laboratorio completa e ben formattata.
Organizza la relazione in sezioni standard come: Introduzione, Materiali e Metodi, Risultati, Discussione e Conclusioni.
Estrai tutti i dati importanti dalla trascrizione e organizzali in modo appropriato.

Trascrizione:
{transcript}

Formato la relazione in markdown.
"""
    
    try:
        # Send request to Ollama API
        response = requests.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            report = result.get("response", "")
            return jsonify({"report": report})
        else:
            return jsonify({"error": f"Ollama API error: {response.text}"}), 500
    
    except Exception as e:
        print(f"Error during report generation: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
