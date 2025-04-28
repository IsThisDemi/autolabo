// utilities/api.ts
export const API_BASE_URL = 'http://localhost:5000';

export const transcribeAudio = async (audioFile: File | Blob, cleanFillerWords: boolean = true): Promise<TranscriptionResult> => {
  // Create FormData object
  const formData = new FormData();
  
  // If it's a Blob, convert it to a File
  if (audioFile instanceof Blob && !(audioFile instanceof File)) {
    const file = new File([audioFile], "recorded_audio.mp3", { type: "audio/mp3" });
    formData.append('file', file);
  } else {
    formData.append('file', audioFile);
  }
  
  // Add clean_filler_words parameter
  formData.append('clean_filler_words', cleanFillerWords.toString());
  
  try {
    // Utilizziamo un controller per il timeout con un tempo più lungo per la trascrizione
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minuti di timeout per la trascrizione
    
    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // Pulisce il timeout se la chiamata ha successo
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return {
      transcript: data.transcript,
      originalTranscript: data.original_transcript,
      cleaned: data.cleaned
    };
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    
    // Gestione specifica per AbortError (timeout)
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new Error("La trascrizione dell'audio ha richiesto troppo tempo. Prova con un file audio più breve o riprova più tardi.");
    }
    
    throw error;
  }
};

export interface ReportResult {
  report: string;
  template: string;
  method: 'ollama' | 'local';
}

export const generateReport = async (transcript: string, templateId: string, metadata: ReportMetadata): Promise<ReportResult> => {
  try {
    console.log('Sending report generation request without timeout');
    
    // Non utilizziamo più il controller per il timeout
    const response = await fetch(`${API_BASE_URL}/api/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        transcript, 
        templateId, 
        metadata 
      })
      // Rimosso signal: controller.signal per non avere timeout
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return {
      report: data.report,
      template: data.template,
      method: data.method || 'local'
    };
  } catch (error: any) {
    console.error('Error generating report:', error);
    
    // Gestione specifica per errori di timeout
    if (error.message?.includes('timeout')) {
      console.log('Detected timeout in report generation:', error.message);
      // In caso di timeout, restituisci un report base con il transcript e un messaggio di errore
      return {
        report: `# Relazione (generazione parziale)\n\n**Nota**: La generazione completa non è stata possibile a causa di un timeout.\n\n## Trascrizione originale\n\n${transcript}`,
        template: templateId,
        method: 'local'
      };
    }
    
    throw error;
  }
};

export interface ReportMetadata {
  title: string;
  author: string;
  institution: string;
}

export interface TranscriptionResult {
  transcript: string;
  originalTranscript: string;
  cleaned: boolean;
}

export interface Template {
  name: string;
  description: string;
  sections: string[];
  icon: string;
}

export const fetchTemplates = async (): Promise<Record<string, Template>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/templates`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

export interface GrammarCorrectionResult {
  text: string;
  timedOut: boolean;
}

export const correctGrammar = async (text: string, style: string = 'academic'): Promise<string | GrammarCorrectionResult> => {
  try {
    console.log('Sending grammar correction request without timeout');
    
    // Non utilizziamo più il controller per il timeout
    const response = await fetch(`${API_BASE_URL}/api/correct-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, style })
      // Rimosso signal: controller.signal per non avere timeout
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
      return data.corrected_text;
  } catch (error: any) {
    console.error('Error correcting grammar:', error);
    
    // Gestione specifica per errori di timeout
    if (error.message?.includes('timeout')) {
      console.log('Detected timeout in grammar correction:', error.message);
      // Restituisci un oggetto che indica che c'è stato un timeout
      return { 
        text: text, // Restituisci il testo originale
        timedOut: true 
      };
    }
    
    throw error;
  }
};

export interface TranscriptCleaningResult {
  text: string;
  timedOut: boolean;
}

export const cleanTranscript = async (text: string): Promise<string | TranscriptCleaningResult> => {
  try {
    console.log('Sending transcript cleaning request without timeout');
    
    // Non utilizziamo più il controller per il timeout
    const response = await fetch(`${API_BASE_URL}/api/clean-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
      // Rimosso signal: controller.signal per non avere timeout
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.cleaned_text;
  } catch (error: any) {
    console.error('Error cleaning transcript:', error);
      
    // Gestione specifica per errori di timeout
    if (error.message?.includes('timeout')) {
      console.log('Detected timeout in transcript cleaning:', error.message);
      // Restituisci un oggetto che indica che c'è stato un timeout
      return { 
        text: text, // Restituisci il testo originale
        timedOut: true 
      };
    }
    
    throw error;
  }
};

export interface MemoryStats {
  memory: {
    gpu: any;  // può essere "N/A" o un oggetto con dettagli
    torch_cuda_available: boolean;
  };
  models: {
    whisper_loaded: boolean;
    cuda_available: boolean;
    device: string;
  };
}

export const getMemoryStats = async (): Promise<MemoryStats> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/memory-stats`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching memory stats:', error);
    throw error;
  }
};

export interface OllamaStatus {
  status: string;
  models: any[];
  current_model: any;
  gpu_check: string;
}

export const getOllamaStatus = async (): Promise<OllamaStatus> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ollama-status`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching Ollama status:', error);
    // Ritorna uno stato offline in caso di errore
    return {
      status: 'offline',
      models: [],
      current_model: null,
      gpu_check: 'Unknown'
    };
  }
};
