"use client";

import React, { useState, useRef, useEffect } from "react";
import AudioRecorder from "./components/AudioRecorder";
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [darkMode, setDarkMode] = useState(false);

  // Check system preference for dark mode
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(darkModeMediaQuery.matches);
    
    const handleDarkModeChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
    
    return () => darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
  }, []);

  // File drag and drop functionality
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        setRecordedAudio(null);
      } else {
        setError("Per favore, carica un file audio valido.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setRecordedAudio(null); // Clear recorded audio when file is selected
    }
  };

  const clearAudio = () => {
    setAudioFile(null);
    setRecordedAudio(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setAudioFile(null); // Clear uploaded file when recording starts
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const handleRecordingComplete = (audioBlob: Blob) => {
    setRecordedAudio(audioBlob);
    
    // Create a URL for the audio blob and set it to the audio element
    if (audioRef.current) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
    }
  };

  const processAudio = async () => {
    // Reset error state
    setError(null);
    
    // Check if we have either uploaded file or recorded audio
    if (!audioFile && !recordedAudio) {
      setError("Per favore, carica un file audio o registra un audio prima di procedere.");
      return;
    }
    
    setIsLoading(true);
    setStep(2);
    
    // Prepare form data with the audio file
    const formData = new FormData();
    if (audioFile) {
      formData.append('file', audioFile);
    } else if (recordedAudio) {
      // Convert Blob to File with .mp3 extension
      const file = new File([recordedAudio], "recorded_audio.mp3", { type: "audio/mp3" });
      formData.append('file', file);
    }
    
    try {
      // Send the audio file to the Python backend
      const response = await fetch('http://localhost:5000/api/transcribe', {
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
      
      setTranscript(data.transcript);
      setStep(3);
      
      // Generate report from transcript
      const reportResponse = await fetch('http://localhost:5000/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: data.transcript }),
      });
      
      if (!reportResponse.ok) {
        throw new Error(`Server responded with ${reportResponse.status}: ${reportResponse.statusText}`);
      }
      
      const reportData = await reportResponse.json();
      
      if (reportData.error) {
        throw new Error(reportData.error);
      }
      
      setReport(reportData.report);
      setStep(4);
      
    } catch (err: any) {
      setError(`Errore: ${err.message}`);
      console.error("Error processing audio:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!report) return;
    
    try {
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add logo and header
      doc.setFontSize(22);
      doc.setTextColor(38, 130, 246); // Primary color
      doc.text("AutoLabo", 105, 15, { align: 'center' });
      
      // Set title
      doc.setFontSize(18);
      doc.setTextColor(23, 37, 84); // Dark blue for text
      doc.text("Relazione di Laboratorio", 105, 30, { align: 'center' });
      
      // Add date
      const today = new Date();
      doc.setFontSize(10);
      doc.text(`Generato il: ${today.toLocaleDateString('it-IT')}`, 105, 38, { align: 'center' });
      
      // Add separator line
      doc.setDrawColor(226, 232, 240); // Border color
      doc.line(20, 45, 190, 45);
      
      // Set content font size
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39); // Very dark gray for text
      
      // Split report text into lines for proper rendering
      const textLines = doc.splitTextToSize(report, 170);
      
      // Add report content
      doc.text(textLines, 20, 55);
      
      // Add footer
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Light slate for footer
      doc.text("AutoLabo - Relazioni di laboratorio generate automaticamente", 105, 285, { align: 'center' });
      
      // Save the PDF
      doc.save("relazione_laboratorio.pdf");
    } catch (err) {
      console.error("Error generating PDF:", err);
      setError("Errore nella generazione del PDF.");
    }
  };

  const resetProcess = () => {
    setStep(1);
    setAudioFile(null);
    setRecordedAudio(null);
    setTranscript(null);
    setReport(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-slate-50'} dark-transition`}>
      <header className={`${darkMode ? 'bg-blue-800 shadow-blue-900/30' : 'bg-blue-600 shadow-blue-500/30'} shadow-lg dark-transition`}>
        <div className="container mx-auto py-6 px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">AutoLabo</h1>
              <p className="text-white opacity-90">Trasforma registrazioni audio in relazioni di laboratorio strutturate</p>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label={darkMode ? "Passa alla modalità chiara" : "Passa alla modalità scura"}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        {error && (
          <div className={`${darkMode ? 'bg-red-900/30 border-red-800 text-red-200' : 'bg-red-100 border-red-400 text-red-700'} border px-4 py-3 rounded-lg mb-4 flex items-center justify-between dark-transition`}>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-sm opacity-70 hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        <div className={`${darkMode ? 'bg-slate-800 shadow-slate-900/50' : 'bg-white shadow-slate-200/50'} rounded-xl shadow-xl p-6 mb-8 card dark-transition`}>          <div className="flex items-center mb-8 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((stepNum) => (
              <React.Fragment key={`step-group-${stepNum}`}>
                <div 
                  className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 transition-colors ${step >= stepNum 
                    ? darkMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-600 text-white' 
                    : darkMode 
                      ? 'bg-slate-700 text-slate-400' 
                      : 'bg-gray-200 text-gray-500'}`}
                >
                  {stepNum}
                </div>
                {stepNum < 4 && (
                  <div 
                    className={`h-1 w-16 mx-2 flex-shrink-0 transition-colors ${step > stepNum 
                      ? darkMode 
                        ? 'bg-blue-600' 
                        : 'bg-blue-600' 
                      : darkMode 
                        ? 'bg-slate-700' 
                        : 'bg-gray-200'}`}
                  ></div>
                )}
              </React.Fragment>
            ))}
          </div>

          {step === 1 && (
            <section className="mb-6">
              <h2 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Carica o registra audio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div 
                  className={`border-2 ${isDragging 
                    ? 'border-blue-500 bg-blue-50' 
                    : darkMode 
                      ? 'border-slate-600 border-dashed' 
                      : 'border-gray-300 border-dashed'} 
                    rounded-xl p-6 text-center transition-colors hover-scale ${darkMode ? 'bg-slate-700/50' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>

                    <p className={`mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                      {isDragging ? "Rilascia qui il file audio" : "Trascina qui un file audio o"}
                    </p>
                    
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                      id="audio-upload" 
                      ref={fileInputRef}
                    />
                    <label 
                      htmlFor="audio-upload" 
                      className={`px-4 py-2 ${darkMode 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md cursor-pointer transition-colors`}
                    >
                      Seleziona file
                    </label>
                    
                    {audioFile && (
                      <div className="mt-4 w-full">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-blue-50'}`}>
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${darkMode ? 'text-blue-300' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <span className={`truncate max-w-[180px] ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                              {audioFile.name}
                            </span>
                          </div>
                          <button 
                            onClick={clearAudio} 
                            className={`ml-2 p-1 rounded-full ${darkMode ? 'hover:bg-slate-500' : 'hover:bg-gray-200'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`border-2 ${darkMode ? 'border-slate-600 border-dashed' : 'border-gray-300 border-dashed'} rounded-xl p-6 text-center hover-scale ${darkMode ? 'bg-slate-700/50' : ''}`}>
                  <div className="flex flex-col items-center justify-center h-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${isRecording 
                      ? 'text-red-500 animate-pulse' 
                      : darkMode 
                        ? 'text-blue-400' 
                        : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    
                    <p className={`mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                      {isRecording ? "Registrazione in corso..." : "Registra audio direttamente"}
                    </p>
                    
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`px-4 py-2 rounded-md ${
                        isRecording 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : darkMode 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                      } text-white transition-colors`}
                    >
                      {isRecording ? 'Ferma registrazione' : 'Inizia registrazione'}
                    </button>
                    
                    <AudioRecorder 
                      isRecording={isRecording} 
                      onStop={stopRecording}
                      onRecordingComplete={handleRecordingComplete} 
                    />
                    
                    {recordedAudio && !isRecording && (
                      <div className="mt-4 w-full">
                        <p className={`mb-2 text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Anteprima della registrazione:</p>
                        <audio ref={audioRef} controls className="w-full"></audio>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={processAudio}
                  disabled={(!audioFile && !recordedAudio) || isLoading}
                  className={`px-6 py-3 rounded-md text-lg font-medium transition-colors ${
                    (!audioFile && !recordedAudio) || isLoading
                      ? darkMode 
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : darkMode 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Elaborazione in corso...
                    </span>
                  ) : 'Elabora Audio'}
                </button>
              </div>
            </section>
          )}

          {step >= 2 && (
            <section className={`mb-6 ${step === 2 && isLoading ? 'animate-pulse' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Trascrizione Audio</h2>
                {step > 2 && (
                  <div className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`}>
                    Completato
                  </div>
                )}
              </div>
              <div className={`rounded-lg p-4 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} dark-transition`}>
                {step === 2 && isLoading ? (
                  <div className="h-24 flex items-center justify-center">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Trascrizione in corso...</p>
                    </div>
                  </div>
                ) : transcript ? (
                  <p className={`whitespace-pre-line ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>{transcript}</p>
                ) : null}
              </div>
            </section>
          )}

          {step >= 3 && (
            <section className={`mb-6 ${step === 3 && isLoading ? 'animate-pulse' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Generazione Relazione</h2>
                {step > 3 && (
                  <div className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`}>
                    Completato
                  </div>
                )}
              </div>
              <div className={`rounded-lg p-4 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} prose max-w-none dark-transition`}>
                {step === 3 && isLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Generazione relazione in corso...</p>
                    </div>
                  </div>
                ) : report ? (
                  <div className={darkMode ? 'text-slate-300' : 'text-gray-700'}>
                    <ReactMarkdown>{report || ''}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {step === 4 && report && (
            <div className="text-center mt-8 space-y-4">
              <button
                onClick={downloadPDF}
                className={`px-6 py-3 ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md transition-colors flex items-center mx-auto`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Scarica Relazione PDF
              </button>
              
              <button
                onClick={resetProcess}
                className={`px-6 py-3 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors flex items-center mx-auto mt-4`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Inizia un nuovo processo
              </button>
            </div>
          )}
        </div>
        
        <footer className={`text-center mt-8 ${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>
          <p>© {new Date().getFullYear()} AutoLabo - Tutti i diritti riservati</p>
          <p className="mt-1">Trasforma le tue registrazioni audio in relazioni di laboratorio complete</p>
        </footer>
      </main>
    </div>
  );
}
