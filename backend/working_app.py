from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

print("Flask app created successfully")

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """
    Returns the list of available templates and their descriptions.
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

def clean_transcript(transcript):
    """
    Function to clean the transcript from filler words and pauses.
    """
    # List of words to remove or replace
    filler_words = [
        r'\behm\b', r'\bmmm\b', r'\buhm\b', r'\buh\b', 
        r'\ballora\b', r'\bcioè\b', r'\becco\b',
        r'\bok adesso\b', r'\bok ora\b', r'\bho sbagliato\b',
        r'\bvediamo\b', r'\bvediamo un attimo\b', r'\bun attimo\b',
        r'\bin pratica\b', r'\bin realtà\b', r'\bin effetti\b',
        r'\bquindi\b', r'\binsomma\b', r'\bcome dire\b',
        r'\bcapito\b', r'\bva bene\b'
    ]
    
    # Remove filler words
    cleaned_text = transcript
    for word in filler_words:
        cleaned_text = re.sub(word, '', cleaned_text, flags=re.IGNORECASE)
    
    # Remove multiple spaces
    cleaned_text = re.sub(r' +', ' ', cleaned_text)
    
    # Remove spaces before punctuation
    cleaned_text = re.sub(r' ([,.!?:;])', r'\1', cleaned_text)
    
    return cleaned_text.strip()

@app.route('/api/correct-text', methods=['POST'])
def correct_text():
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    
    # For now, just return a slightly improved version of the same text
    corrected_text = text.replace(" i ", " I ").replace(" e ", " e, ")
    corrected_text = corrected_text[0].upper() + corrected_text[1:]
    if not corrected_text.endswith((".", "!", "?")):
        corrected_text += "."
    
    return jsonify({"corrected_text": corrected_text})

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    data = request.json
    
    if not data or 'transcript' not in data:
        return jsonify({"error": "No transcript provided"}), 400
    
    transcript = data['transcript']
    template_id = data.get('templateId', 'lab_report')
    metadata = data.get('metadata', {})
    
    # Create a simple sample report based on template
    if template_id == 'lab_report':
        report = f"""## Introduzione
Questa è una relazione di laboratorio generata automaticamente.

## Materiali e Metodi
Dalla trascrizione si evidenziano i seguenti materiali e metodi utilizzati:
- {transcript[:50]}...

## Risultati
I risultati dell'esperimento sono stati documentati.

## Discussione
L'analisi dei risultati mostra correlazioni interessanti.

## Conclusioni
In conclusione, l'esperimento ha dimostrato con successo la teoria iniziale."""
    elif template_id == 'technical_report':
        report = f"""## Sommario Esecutivo
Questo report tecnico descrive le procedure e i risultati dell'esperimento.

## Obiettivi
Gli obiettivi principali sono stati definiti come segue.

## Specifiche Tecniche
Le specifiche tecniche dell'apparato sperimentale includono:
- {transcript[:50]}...

## Metodologia
La metodologia adottata segue le pratiche standard del settore.

## Risultati
I risultati mostrano un incremento di efficienza del 15%.

## Raccomandazioni
Si raccomanda di proseguire con test più approfonditi."""
    else:
        report = f"""# Report

Questo è un report generato automaticamente basato sul template selezionato.

Contenuto principale:
{transcript[:100]}..."""
    
    # Add metadata
    title = metadata.get('title', 'Report')
    author = metadata.get('author', 'Autore')
    institution = metadata.get('institution', 'Istituzione')
    
    report_with_metadata = f"""
# {title}

**Autore:** {author}  
**Istituzione:** {institution}  
**Data:** {datetime.now().strftime("%d/%m/%Y")}  

---

{report}
"""
    
    return jsonify({
        "report": report_with_metadata,
        "template": template_id
    })

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    # Simplified endpoint - just returns a sample transcript for testing
    return jsonify({
        "transcript": "Questo è un esempio di trascrizione. In un sistema completo, qui verrebbe mostrata la trascrizione audio generata da Whisper.",
        "original_transcript": "Questo è un esempio ehm di trascrizione. In un sistema completo, qui verrebbe mmm mostrata la trascrizione audio generata da Whisper.",
        "cleaned": True
    })

if __name__ == '__main__':
    print("Starting Flask server...")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
