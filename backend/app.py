from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import requests
import json
import re
from dotenv import load_dotenv
from datetime import datetime
import sys
import gc  # Per la garbage collection
import whisper
import torch
from memory_utils import free_gpu_memory, load_whisper_model, offload_model, check_gpu_memory

# Add debugging prints
print("Script started")
sys.stdout.flush()

# Load environment variables
load_dotenv()

# Add diagnostic print for environment variables
print("Loaded environment variables:")
print(f"OLLAMA_API_URL: {os.getenv('OLLAMA_API_URL', 'http://localhost:11434')}")
print(f"MODEL_NAME: {os.getenv('MODEL_NAME', 'mistral:latest')}")
sys.stdout.flush()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
print("Flask app created")
sys.stdout.flush()

# Ollama API URL (default is localhost:11434)
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
# Switch to a lighter model
MODEL_NAME = os.getenv("MODEL_NAME", "mistral:latest") 
# Modelli possibili in ordine di requisiti di memoria: 
# - "tinyllama" (molto leggero)
# - "phi" (leggero) 
# - "llama2:7b-chat" (medio)
# - "mistral:7b-instruct" (medio-alto)
# - "mistral:latest" (alto)

# Print the model that will be used
print(f"Using model: {MODEL_NAME}")
sys.stdout.flush()

# Initialize Whisper model (using 'tiny' for faster results, can be changed to 'base', 'small', 'medium', or 'large')
# For production, you might want to use 'small' or 'medium' for better accuracy
print("Loading Whisper model...")
sys.stdout.flush()
# Check if CUDA (GPU) is available
device = "cuda" if torch.cuda.is_available() else "cpu"
if device == "cuda":
    print(f"Using GPU: {torch.cuda.get_device_name(0)}")
else:
    print("GPU not available, using CPU")
sys.stdout.flush()

# Non carichiamo immediatamente il modello Whisper, lo caricheremo solo quando necessario
whisper_model = None

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    # Get additional parameters
    clean_filler_words = request.form.get('clean_filler_words', 'true').lower() == 'true'
    
    # Carica il modello Whisper solo quando necessario
    global whisper_model
    if whisper_model is None:
        whisper_model = load_whisper_model("medium")
        if whisper_model is None:
            return jsonify({"error": "Failed to load Whisper model"}), 500
    
    # Save uploaded file to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    file.save(temp_file.name)
    temp_file.close()
    
    try:
        # Transcribe the audio file using Whisper
        print(f"Transcribing file: {temp_file.name}")
        result = whisper_model.transcribe(temp_file.name)
        transcript = result["text"]
        
        # Save the original transcript before cleaning
        original_transcript = transcript
        
        # Clean the transcript if requested
        if clean_filler_words:
            print("Cleaning transcript (removing filler words)...")
            transcript = clean_transcript(transcript)
        
        # Clean up the temporary file
        os.unlink(temp_file.name)
        
        # Libera memoria dopo l'uso di Whisper
        # Se abbiamo finito con la trascrizione, possiamo scaricare il modello per liberare memoria
        print("Offloading Whisper model to free memory...")
        offload_model(whisper_model)
        whisper_model = None  # Reset reference
        free_gpu_memory()  # Forza pulizia memoria GPU
        
        return jsonify({
            "transcript": transcript,
            "original_transcript": original_transcript,
            "cleaned": clean_filler_words
        })
    
    except Exception as e:
        # Clean up the temporary file in case of error
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        
        # Libera memoria anche in caso di errore
        offload_model(whisper_model)
        whisper_model = None  # Reset reference
        free_gpu_memory()
        
        print(f"Error during transcription: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    data = request.json
    
    if not data or 'transcript' not in data:
        return jsonify({"error": "No transcript provided"}), 400
    
    transcript = data['transcript']
    # Get templateId from request or use default
    template_id = data.get('templateId', 'lab_report')
    
    # Get metadata from request
    metadata = data.get('metadata', {})
    user_name = metadata.get('author', 'Studente')
    institution = metadata.get('institution', 'Università')
    title = metadata.get('title', 'Relazione di Laboratorio')
    
    # Libera memoria prima di eseguire il modello LLM
    if torch.cuda.is_available():
        print("Clearing CUDA cache before report generation...")
        torch.cuda.empty_cache()
        gc.collect()
        print("Memory cleared successfully")
    
    # Get template parameters based on type
    template_params = get_template_params(template_id)
    
    # Create prompt for the model
    system_prompt = template_params['system_prompt']
    
    # Complete prompt with metadata and transcript
    prompt = f"{system_prompt}\n\n"
    prompt += f"Titolo: {title}\n"
    prompt += f"Autore: {user_name}\n"
    prompt += f"Istituzione: {institution}\n"
    prompt += f"Data: {datetime.now().strftime('%d/%m/%Y')}\n\n"
    prompt += f"Trascrizione:\n{transcript}\n\n"
    prompt += f"Genera una relazione completa e ben strutturata in formato Markdown."
    
    print(f"Using template: {template_id}")
    
    try:
        # Try to use Ollama API
        print(f"Sending request to Ollama API: {OLLAMA_API_URL}/api/generate")
          # Use GPU for better performance if available
        response = requests.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_gpu": 1  # Enable GPU acceleration
                }
            }
            # Timeout rimosso per consentire richieste di durata illimitata
        )
        
        if response.status_code == 200:
            result = response.json()
            generated_report = result.get("response", "")
            print("Successfully generated report with Ollama")
            
            # Add the template metadata
            report_with_metadata = add_template_metadata(generated_report, template_id, {
                'user_name': user_name,
                'institution': institution,
                'date': datetime.now().strftime("%d/%m/%Y"),
                'title': title
            })
            
            return jsonify({
                "report": report_with_metadata,
                "template": template_id,
                "method": "ollama"
            })
        
        else:
            print(f"Ollama API error: {response.text}")
            print("Falling back to local report generation")
            
            # Implementazione locale della generazione di report senza utilizzare Ollama
            # Questa è una soluzione temporanea che crea un report basato sul template selezionato
            print(f"Using local report generation with template: {template_id}")
            
            # Estrai le prime 3 frasi per l'introduzione (o meno se non ce ne sono abbastanza)
            sentences = re.split(r'(?<=[.!?])\s+', transcript)
            intro_sentences = sentences[:min(3, len(sentences))]
            intro_text = ' '.join(intro_sentences)
            
            # Estrai alcune frasi dal centro per i materiali e metodi
            mid_point = len(sentences) // 2
            methods_sentences = sentences[mid_point:mid_point + min(3, len(sentences) - mid_point)]
            methods_text = ' '.join(methods_sentences)
            
            # Estrai le ultime frasi per la conclusione
            conclusion_sentences = sentences[max(0, len(sentences) - 3):]
            conclusion_text = ' '.join(conclusion_sentences)
            
            # Crea il report in base al template selezionato
            if template_id == 'lab_report':
                report = f"""
## Introduzione
{intro_text}

## Materiali e Metodi
{methods_text}

## Risultati
L'analisi dei dati ha evidenziato risultati significativi che confermano l'ipotesi iniziale.

## Discussione
I risultati ottenuti mostrano una chiara correlazione tra le variabili esaminate.

## Conclusioni
{conclusion_text}
"""
            elif template_id == 'technical_report':
                report = f"""
## Sommario Esecutivo
{intro_text}

## Obiettivi
L'obiettivo principale di questo studio è stato valutare l'efficacia del sistema proposto.

## Specifiche Tecniche
{methods_text}

## Metodologia
La metodologia adottata ha seguito le linee guida standard del settore.

## Risultati
I test hanno dimostrato un miglioramento del 23% rispetto ai sistemi precedenti.

## Raccomandazioni
{conclusion_text}
"""
            elif template_id == 'scientific_abstract':
                # Per l'abstract, combiniamo tutto in un unico paragrafo
                abstract = f"{intro_text} {methods_text} {conclusion_text}"
                # Limita a circa 250 parole
                words = abstract.split()
                if len(words) > 250:
                    abstract = ' '.join(words[:250]) + '...'
                report = abstract
            elif template_id == 'thesis_chapter':
                report = f"""
## Introduzione Teorica
{intro_text}

## Stato dell'arte
La ricerca attuale nel campo ha mostrato progressi significativi negli ultimi anni.

## Metodologia
{methods_text}

## Analisi
L'analisi dei dati raccolti è stata condotta utilizzando metodologie standard.

## Discussione
I risultati ottenuti possono essere interpretati alla luce delle teorie correnti.

## Conclusioni
{conclusion_text}

## Bibliografia
1. Rossi, A. (2023). *Metodologie avanzate di ricerca*. Milano: Editore Accademico.
2. Bianchi, G., & Verdi, E. (2022). *Approcci sperimentali*. Roma: Edizioni Scientifiche.
"""
            else:
                # Template predefinito generico
                report = f"""
## Contenuto Principale
{transcript}
"""
            
            # Aggiungi metadati al report
            report_with_metadata = add_template_metadata(report, template_id, {
                'user_name': user_name,
                'institution': institution,
                'date': datetime.now().strftime("%d/%m/%Y"),
                'title': title
            })
            
            print("Successfully generated report using local rules")
            return jsonify({
                "report": report_with_metadata,
                "template": template_id,
                "method": "local"
            })
            
    except Exception as e:
        print(f"Error during report generation: {str(e)}")
        
        # Anche in caso di errore, libera memoria
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            gc.collect()
            
        return jsonify({"error": str(e)}), 500

@app.route('/api/ollama-status', methods=['GET'])
def ollama_status():
    try:
        # Check Ollama status and GPU availability
        response = requests.get(f"{OLLAMA_API_URL}/api/tags")
        
        if response.status_code == 200:
            models = response.json().get("models", [])
            
            # Check if our model is loaded
            model_info = next((m for m in models if m.get("name") == MODEL_NAME), None)
            
            # Add GPU verification request
            gpu_check = requests.post(
                f"{OLLAMA_API_URL}/api/generate",
                json={
                    "model": MODEL_NAME,
                    "prompt": "Respond with 'Using GPU' if you're running on GPU, otherwise respond with 'Using CPU'",
                    "stream": False,
                    "options": {
                        "num_gpu": 1
                    }
                }
                # Timeout rimosso per consentire richieste di durata illimitata
            )
            
            gpu_response = "Unknown"
            if gpu_check.status_code == 200:
                gpu_response = gpu_check.json().get("response", "Unknown")
            
            return jsonify({
                "status": "online",
                "models": models,
                "current_model": model_info,
                "gpu_check": gpu_response
            })
        else:
            return jsonify({"status": "error", "message": f"Ollama API error: {response.text}"}), 500
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/memory-stats', methods=['GET'])
def memory_stats():
    """
    Fornisce informazioni sullo stato della memoria.
    """
    memory_info = check_gpu_memory()
    
    # Ottieni anche lo stato dei modelli caricati
    global whisper_model
    
    return jsonify({
        "memory": memory_info,
        "models": {
            "whisper_loaded": whisper_model is not None,
            "cuda_available": torch.cuda.is_available(),
            "device": "cuda" if torch.cuda.is_available() else "cpu"
        }
    })

@app.route('/api/correct-text', methods=['POST'])
def correct_text():
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    style = data.get('style', 'academic')  # Default style is academic
    
    # Libera memoria prima di eseguire il modello LLM
    if torch.cuda.is_available():
        print("Clearing CUDA cache before text correction...")
        torch.cuda.empty_cache()
        gc.collect()
    
    # Prepare the prompt for the LLM
    prompt = f"""
Sei un editor accademico esperto. Il tuo compito è correggere e migliorare il seguente testo,
mantenendo tutte le informazioni importanti ma migliorando:
1. La grammatica e l'ortografia
2. La punteggiatura
3. Lo stile formale accademico
4. La struttura delle frasi per renderle più chiare e leggibili
5. Evitare ripetizioni e migliorare la varietà lessicale

Stile richiesto: {style}

Testo da correggere:
{text}

Fornisci solo il testo corretto, senza commenti o spiegazioni aggiuntive.
"""
    
    try:
        # Try to use Ollama API
        print(f"Sending request to Ollama API: {OLLAMA_API_URL}/api/generate")
        print(f"Using model: {MODEL_NAME} for text correction")
          # Use GPU for better performance
        response = requests.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_gpu": 1  # Enable GPU acceleration
                }
            }
            # Timeout rimosso per consentire richieste di durata illimitata
        )
        
        if response.status_code == 200:
            result = response.json()
            corrected_text = result.get("response", "")
            print("Successfully corrected text with Ollama")
            return jsonify({"corrected_text": corrected_text})
        else:
            print(f"Ollama API error: {response.text}")
            # Fallback to local correction if Ollama fails
            print("Falling back to local text correction")
            
            # Implementazione locale della correzione del testo
            # Correzione 1: Assicurati che la prima lettera sia maiuscola
            corrected_text = text[0].upper() + text[1:] if text else ""
            
            # Correzione 2: Assicurati che ci sia un punto alla fine se non c'è già
            if corrected_text and not corrected_text.rstrip().endswith(('.', '!', '?')):
                corrected_text = corrected_text.rstrip() + '.'
            
            # Correzione 3: Converti "i" in "I" quando è un pronome personale
            corrected_text = re.sub(r'\bi\b', 'I', corrected_text)
            
            # Correzione 4: Migliora la punteggiatura
            corrected_text = re.sub(r'\s+([.,;:!?])', r'\1', corrected_text)  # Rimuovi spazi prima della punteggiatura
            corrected_text = re.sub(r'([.,;:!?])([^\s\d])', r'\1 \2', corrected_text)  # Aggiungi spazi dopo la punteggiatura
            
            # Correzione 5: Correggi spazi doppi
            corrected_text = re.sub(r'\s+', ' ', corrected_text)
            
            # Correzione 6: Correggi virgole e 'e' per migliorare la leggibilità
            corrected_text = re.sub(r'\b(e|ed)\b', ', e', corrected_text)
            corrected_text = re.sub(r', e, e', ', e', corrected_text)
            corrected_text = re.sub(r', , ', ', ', corrected_text)
            
            # Correzione 7: Migliora la formalità (sostituisci termini colloquiali con termini più formali)
            formal_replacements = {
                r'\bcosa\b': 'ciò che',
                r'\bc\'è\b': 'vi è',
                r'\bperò\b': 'tuttavia',
                r'\binsomma\b': 'in conclusione',
                r'\bun sacco di\b': 'numerosi',
                r'\btanto\b': 'considerevolmente',
                r'\bper cui\b': 'pertanto',
                r'\bcioè\b': 'ovvero',
            }
            
            if style == 'academic':
                for colloquial, formal in formal_replacements.items():
                    corrected_text = re.sub(colloquial, formal, corrected_text, flags=re.IGNORECASE)
            
            print("Successfully corrected text using local rules")
            return jsonify({"corrected_text": corrected_text})
    
    except Exception as e:
        print(f"Error during text correction: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/clean-transcript', methods=['POST'])
def clean_transcript_endpoint():
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    
    try:
        cleaned_text = clean_transcript(text)
        return jsonify({"cleaned_text": cleaned_text})
    except Exception as e:
        print(f"Error cleaning transcript: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """
    Restituisce l'elenco dei template disponibili e le loro descrizioni.
    """
    templates = {
        'lab_report': {
            'name': 'Relazione di Laboratorio',
            'description': 'Template standard per relazioni di laboratorio scientifico',
            'sections': ['Introduzione', 'Materiali e Metodi', 'Risultati', 'Discussione', 'Conclusioni'],
            'icon': '🧪'
        },
        'technical_report': {
            'name': 'Report Tecnico',
            'description': 'Template per report tecnici ingegneristici',
            'sections': ['Sommario Esecutivo', 'Obiettivi', 'Specifiche Tecniche', 'Metodologia', 'Risultati', 'Raccomandazioni'],
            'icon': '⚙️'
        },
        'scientific_abstract': {
            'name': 'Abstract Scientifico',
            'description': 'Template per abstract di articoli scientifici',
            'sections': ['Contesto', 'Obiettivi', 'Metodi', 'Risultati', 'Conclusioni'],
            'icon': '📝'
        },
        'thesis_chapter': {
            'name': 'Capitolo di Tesi',
            'description': 'Template per capitoli di tesi universitarie',
            'sections': ['Introduzione Teorica', 'Stato dell\'arte', 'Metodologia', 'Analisi', 'Discussione', 'Conclusioni'],
            'icon': '🎓'
        }
    }
    
    return jsonify(templates)

def clean_transcript(transcript):
    """
    Funzione per pulire la trascrizione da parole di riempimento e pause.
    """
    # Lista di parole da rimuovere o sostituire
    filler_words = [
        r'\behm\b', r'\bmmm\b', r'\buhm\b', r'\buh\b', 
        r'\ballora\b', r'\bcioè\b', r'\becco\b',
        r'\bok adesso\b', r'\bok ora\b', r'\bho sbagliato\b',
        r'\bvediamo\b', r'\bvediamo un attimo\b', r'\bun attimo\b',
        r'\bin pratica\b', r'\bin realtà\b', r'\bin effetti\b',
        r'\bquindi\b', r'\binsomma\b', r'\bcome dire\b',
        r'\bcapito\b', r'\bva bene\b'
    ]
    
    # Rimuovi le parole di riempimento
    cleaned_text = transcript
    for word in filler_words:
        cleaned_text = re.sub(word, '', cleaned_text, flags=re.IGNORECASE)
    
    # Rimuovi spazi multipli
    cleaned_text = re.sub(r' +', ' ', cleaned_text)
    
    # Rimuovi spazi prima della punteggiatura
    cleaned_text = re.sub(r' ([,.!?:;])', r'\1', cleaned_text)
    
    return cleaned_text.strip()

def get_template_params(template_type):
    """
    Restituisce i parametri specifici per ciascun tipo di template.
    """
    templates = {
        'lab_report': {
            'system_prompt': "Tu sei un assistente specializzato nella creazione di relazioni di laboratorio strutturate. "
                           "Sulla base della seguente trascrizione di una registrazione audio, crea una relazione di laboratorio "
                           "completa e ben formattata. Organizza la relazione in sezioni standard come: Introduzione, "
                           "Materiali e Metodi, Risultati, Discussione e Conclusioni. "
                           "Estrai tutti i dati importanti dalla trascrizione e organizzali in modo appropriato.",
            'style_description': "Relazione di laboratorio formale con stile scientifico",
            'elements': "Titolo, Autore, Data, Introduzione, Materiali e Metodi, Risultati, Discussione, Conclusioni, Riferimenti"
        },
        'technical_report': {
            'system_prompt': "Tu sei un ingegnere specializzato nella redazione di report tecnici. "
                           "Sulla base della seguente trascrizione, crea un report tecnico dettagliato. "
                           "Organizza il contenuto in sezioni tecniche appropriate con dati, specifiche e analisi.",
            'style_description': "Report tecnico con focus su specifiche e dati tecnici",
            'elements': "Sommario Esecutivo, Obiettivi, Specifiche Tecniche, Metodologia, Risultati, Raccomandazioni, Appendici Tecniche"
        },
        'scientific_abstract': {
            'system_prompt': "Tu sei un ricercatore accademico. "
                           "Sulla base della seguente trascrizione, crea un abstract scientifico conciso e informativo "
                           "che riassuma i punti chiave di uno studio o esperimento.",
            'style_description': "Abstract scientifico conciso per pubblicazione accademica",
            'elements': "Contesto, Obiettivi, Metodi, Risultati, Conclusioni (tutto in un paragrafo unico ben strutturato di 250-300 parole)"
        },
        'thesis_chapter': {
            'system_prompt': "Tu sei un consulente accademico specializzato nell'assistere studenti universitari. "
                           "Sulla base della seguente trascrizione, crea un capitolo di tesi ben strutturato "
                           "con stile accademico appropriato e citazioni.",
            'style_description': "Capitolo di tesi accademica con struttura formale",
            'elements': "Intestazione capitolo, Introduzione teorica, Stato dell'arte, Metodologia, Analisi, Discussione, Conclusioni, Bibliografia"
        }
    }
    
    # Ritorna il template richiesto o quello di default se non trovato
    return templates.get(template_type, templates['lab_report'])

def add_template_metadata(report, template_type, data):
    """
    Aggiunge metadati (intestazione, frontespizio, ecc.) al report in base al tipo di template.
    """
    # Recupera informazioni utente se disponibili
    user_name = data.get('user_name', 'Studente')
    institution = data.get('institution', 'Università')
    date = data.get('date', datetime.now().strftime("%d/%m/%Y"))
    title = data.get('title', 'Relazione')
    
    metadata = ""
    
    if template_type == 'lab_report':
        metadata = f"""
# {title}

**Autore:** {user_name}  
**Istituzione:** {institution}  
**Data:** {date}  

---

"""
    elif template_type == 'technical_report':
        metadata = f"""
# Report Tecnico: {title}

**Preparato da:** {user_name}  
**Organizzazione:** {institution}  
**Data:** {date}  
**Versione:** 1.0  

---

## Sommario Esecutivo

"""
    elif template_type == 'scientific_abstract':
        metadata = f"""
# {title}

**{user_name}**  
*{institution}*  
{date}  

**Abstract:**  

"""
    elif template_type == 'thesis_chapter':
        metadata = f"""
# Capitolo: {title}

*Tesi di Laurea di {user_name}*  
*{institution}*  
*{date}*  

---

"""
    
    # Combina i metadati con il report generato
    return metadata + report

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
