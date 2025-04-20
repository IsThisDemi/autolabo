// utilities/api.ts
export const API_BASE_URL = 'http://localhost:5000';

export const transcribeAudio = async (audioFile: File | Blob): Promise<string> => {
  // Create FormData object
  const formData = new FormData();
  
  // If it's a Blob, convert it to a File
  if (audioFile instanceof Blob && !(audioFile instanceof File)) {
    const file = new File([audioFile], "recorded_audio.mp3", { type: "audio/mp3" });
    formData.append('file', file);
  } else {
    formData.append('file', audioFile);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};

export const generateReport = async (transcript: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.report;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};
