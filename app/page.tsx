"use client";

import React, { useState, useRef, useEffect } from "react";
import AudioRecorder from "./components/AudioRecorder";
import TemplateSelector from "./components/TemplateSelector";
import TextEditorOptions from "./components/TextEditorOptions";
import ReportMetadata from "./components/ReportMetadata";
import SystemStatus from "./components/SystemStatus";
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { 
  transcribeAudio, 
  generateReport, 
  correctGrammar, 
  cleanTranscript, 
  ReportMetadata as ReportMetadataType,
  TranscriptionResult,
  ReportResult 
} from "./utilities/api";

export default function Home() {  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [originalTranscript, setOriginalTranscript] = useState<string | null>(null);
  const [editedTranscript, setEditedTranscript] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportMethod, setReportMethod] = useState<'ollama' | 'local' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [darkMode, setDarkMode] = useState(false);
  
  // Nuovi stati per le nuove funzionalità
  const [selectedTemplate, setSelectedTemplate] = useState<string>("lab_report");
  const [grammarCorrectionStatus, setGrammarCorrectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reportTitle, setReportTitle] = useState<string>("Relazione di Laboratorio");
  const [userName, setUserName] = useState<string>("Studente");
  const [institution, setInstitution] = useState<string>("Università");

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
  };  // Nuova funzione per correggere la grammatica
  const handleCorrectGrammar = async () => {
    if (!editedTranscript) return;
    
    try {
      setGrammarCorrectionStatus('loading');
      const result = await correctGrammar(editedTranscript);
      
      // Verifica se il risultato è un oggetto con un flag di timeout
      if (typeof result === 'object' && 'timedOut' in result) {
        setGrammarCorrectionStatus('error');
        setError("La correzione grammaticale è scaduta. Il testo non è stato modificato.");
        // Non modifichiamo il testo in caso di timeout
      } else {
        // Qui result è una stringa
        setEditedTranscript(result);
        setGrammarCorrectionStatus('success');
      }
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setGrammarCorrectionStatus('idle');
      }, 3000);
    } catch (err: any) {
      console.error("Errore durante la correzione grammaticale:", err);
      setError(`Errore nella correzione grammaticale: ${err.message}`);
      setGrammarCorrectionStatus('error');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setGrammarCorrectionStatus('idle');
      }, 3000);
    }
  };
    // Nuova funzione per rimuovere parti inutili
  const handleCleanFiller = async () => {
    if (!editedTranscript) return;
    
    try {
      setIsLoading(true);
      const result = await cleanTranscript(editedTranscript);
      
      // Verifica se il risultato è un oggetto con un flag di timeout
      if (typeof result === 'object' && 'timedOut' in result) {
        setError("La pulizia del testo è scaduta. Il testo non è stato modificato.");
        // Non modifichiamo il testo in caso di timeout
      } else {
        // Qui result è una stringa
        setEditedTranscript(result);
      }
    } catch (err: any) {
      setError(`Errore nella pulizia del testo: ${err.message}`);
    } finally {
      setIsLoading(false);
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
    
    try {
      // Use our API function to transcribe the audio
      const audioToTranscribe = audioFile || recordedAudio;
      if (!audioToTranscribe) {
        throw new Error("Nessun audio da elaborare");
      }
      
      const result = await transcribeAudio(audioToTranscribe, true);
      
      setTranscript(result.transcript);
      setOriginalTranscript(result.originalTranscript);
      setEditedTranscript(result.transcript); // Initialize edited transcript with processed one
      setStep(3); // Move to editing step
      
    } catch (err: any) {
      setError(`Errore: ${err.message}`);
      console.error("Error processing audio:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReportFromTranscript = async () => {
    if (!editedTranscript) {
      setError("Nessuna trascrizione disponibile.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepare metadata
      const metadata: ReportMetadataType = {
        title: reportTitle || "Relazione di Laboratorio",
        author: userName || "Studente",
        institution: institution || "Università"
      };
      
      // Generate report using API
      const result = await generateReport(
        editedTranscript,
        selectedTemplate,
        metadata
      );
      
      setReport(result.report);
      setReportMethod(result.method);
      setStep(4); // Move to report step
      
    } catch (err: any) {
      setError(`Errore nella generazione del report: ${err.message}`);
      console.error("Error generating report:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!report) {
      setError("Nessun report disponibile per il download.");
      return;
    }
    
    try {
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add logo and header
      doc.setFontSize(22);
      doc.setTextColor(23, 37, 84); // Deep blue
      doc.text(reportTitle || "Relazione di Laboratorio", 105, 20, { align: 'center' });
      
      // Add author and institution
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105); // Slate
      doc.text(`Autore: ${userName || "Studente"}`, 105, 30, { align: 'center' });
      doc.text(`Istituzione: ${institution || "Università"}`, 105, 37, { align: 'center' });
      
      // Add line separator
      doc.setDrawColor(226, 232, 240); // Light slate
      doc.setLineWidth(0.5);
      doc.line(20, 45, 190, 45);
      
      // Set content font size
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Dark blue gray
      
      // Add report content
      const lines = doc.splitTextToSize(report.replace(/#+\s/g, '').replace(/\*\*/g, ''), 170);
      doc.text(lines, 20, 55);
      
      // Add footer
      doc.setTextColor(100, 116, 139); // Light slate for footer
      doc.text("AutoLabo - Relazioni di laboratorio generate automaticamente", 105, 285, { align: 'center' });
      
      // Save the PDF with custom filename based on title
      const filename = reportTitle
        ? reportTitle.toLowerCase().replace(/\s+/g, '_') + '.pdf'
        : "relazione_laboratorio.pdf";
      
      doc.save(filename);
    } catch (err) {
      console.error("Error generating PDF:", err);
      setError("Errore nella generazione del PDF.");
    }
  };

  const resetApp = () => {
    setAudioFile(null);
    setRecordedAudio(null);
    setTranscript(null);
    setOriginalTranscript(null);
    setEditedTranscript(null);
    setReport(null);
    setReportMethod(null);
    setError(null);
    setStep(1);
    setUserName("Studente");
    setInstitution("Università");
    setReportTitle("Relazione di Laboratorio");
    setSelectedTemplate("lab_report");
    setGrammarCorrectionStatus('idle');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <main className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <h1 className="text-3xl font-bold text-blue-600">AutoLabo</h1>
            <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">Beta</span>
          </div>
          
          <div className="flex items-center">
            <button 
              className={`mr-4 px-3 py-1 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>        </div>
        
        {/* Nuovo componente per visualizzare lo stato del sistema */}
        <SystemStatus darkMode={darkMode} />
        
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className={`flex flex-col items-center ${step >= 1 ? 'text-blue-600' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 ${
                step >= 1 
                  ? 'bg-blue-100 text-blue-600' 
                  : (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
              }`}>
                1
              </div>
              <span className="text-sm">Audio</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}></div>
            <div className={`flex flex-col items-center ${step >= 2 ? 'text-blue-600' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 ${
                step >= 2 
                  ? 'bg-blue-100 text-blue-600' 
                  : (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
              }`}>
                2
              </div>
              <span className="text-sm">Trascrizione</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-blue-600' : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}></div>
            <div className={`flex flex-col items-center ${step >= 3 ? 'text-blue-600' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 ${
                step >= 3 
                  ? 'bg-blue-100 text-blue-600' 
                  : (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
              }`}>
                3
              </div>
              <span className="text-sm">Modifica</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 4 ? 'bg-blue-600' : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}></div>
            <div className={`flex flex-col items-center ${step >= 4 ? 'text-blue-600' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 ${
                step >= 4 
                  ? 'bg-blue-100 text-blue-600' 
                  : (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
              }`}>
                4
              </div>
              <span className="text-sm">Report</span>
            </div>
          </div>
        </div>
          {/* Error display */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg flex items-start ${
            darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Errore</p>
              <p>{error}</p>
            </div>
            <button 
              className={`ml-auto ${darkMode ? 'text-red-300 hover:text-red-200' : 'text-red-700 hover:text-red-900'}`}
              onClick={() => setError(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
          {/* Step 1: Audio Input */}
        {step === 1 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
            <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Carica o Registra Audio</h2>
            
            {/* Audio file upload */}
            <div 
              className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors
                ${isDragging 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                  : darkMode 
                    ? 'border-gray-600 hover:bg-gray-700' 
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="audio/*" 
                onChange={handleFileChange}
              />
                {audioFile ? (
                <div>
                  <div className="flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{audioFile.name}</p>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <button 
                    className={`mt-4 px-4 py-2 rounded-md transition-colors ${
                      darkMode 
                        ? 'bg-red-900/50 text-red-300 hover:bg-red-800/50' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAudio();
                    }}
                  >
                    Rimuovi
                  </button>
                </div>
              ) : recordedAudio ? (
                <div>
                  <div className="flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Registrazione completata</p>
                  <audio ref={audioRef} controls className="mt-4 w-full max-w-md mx-auto"></audio>
                  <button 
                    className={`mt-4 px-4 py-2 rounded-md transition-colors ${
                      darkMode 
                        ? 'bg-red-900/50 text-red-300 hover:bg-red-800/50' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAudio();
                    }}
                  >
                    Rimuovi
                  </button>
                </div>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className={`font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Trascina qui il tuo file audio o clicca per caricare</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Supporta MP3, WAV, M4A, etc.</p>
                </>
              )}
            </div>
            
            {/* Audio recording */}            <div className="mb-6">
              <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Oppure registra un audio</h3><AudioRecorder 
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onRecordingComplete={handleRecordingComplete}
                darkMode={darkMode}
              />
            </div>
            
            {/* Continue button */}
            <div className="mt-8">
              <button                className={`px-6 py-3 rounded-md font-medium transition-colors w-full md:w-auto
                  ${(audioFile || recordedAudio) && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : darkMode 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                onClick={processAudio}
                disabled={!audioFile && !recordedAudio || isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Elaborazione in corso...
                  </>
                ) : 'Procedi alla trascrizione'}
              </button>
            </div>
          </div>
        )}
          {/* Step 2: Loading */}
        {step === 2 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8 text-center py-16`}>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
            <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Trascrizione in corso...</h2>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>Stiamo analizzando il file audio. Questo processo potrebbe richiedere alcuni minuti.</p>
          </div>
        )}
        
        {/* Step 3: Transcript Editing */}
        {step === 3 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
            <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Modifica trascrizione</h2>
            
            <div className="mb-6">              <TextEditorOptions 
                onCorrectGrammar={handleCorrectGrammar}
                onCleanFiller={handleCleanFiller}
                correctionStatus={grammarCorrectionStatus}
                darkMode={darkMode}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="transcript" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Trascrizione
              </label>
              <textarea
                id="transcript"
                className={`w-full p-3 border rounded-md min-h-[300px] font-mono text-sm ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'border-gray-300 text-gray-800 bg-white'
                }`}
                value={editedTranscript || ''}
                onChange={(e) => setEditedTranscript(e.target.value)}
                ref={transcriptTextareaRef}
              />
            </div>
            
            <div className="mb-6">
              <ReportMetadata
                title={reportTitle}
                author={userName}
                institution={institution}
                onTitleChange={setReportTitle}
                onAuthorChange={setUserName}
                onInstitutionChange={setInstitution}
                darkMode={darkMode}
              />
            </div>
            
            <div className="mb-6">
              <TemplateSelector 
                selectedTemplate={selectedTemplate}
                onTemplateChange={setSelectedTemplate}
                darkMode={darkMode}
              />
            </div>
            
            <div className="flex justify-between mt-8">              <button
                className={`px-4 py-2 border rounded-md font-medium transition-colors ${
                  darkMode 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setStep(1)}
              >
                Indietro
              </button>
              <button                className={`px-6 py-3 rounded-md font-medium transition-colors
                  ${editedTranscript && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : darkMode 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                onClick={generateReportFromTranscript}
                disabled={!editedTranscript || isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generazione report...
                  </>
                ) : 'Genera report'}
              </button>
            </div>
          </div>
        )}
          {/* Step 4: Report Display */}
        {step === 4 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{reportTitle || "Relazione di Laboratorio"}</h2>
              
              {reportMethod && (
                <div className={`px-3 py-1 rounded-lg text-sm ${
                  reportMethod === 'ollama' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {reportMethod === 'ollama' 
                    ? 'Generato con Mistral AI' 
                    : 'Generato con elaborazione locale'}
                </div>
              )}
            </div>
            
            <div className={`prose max-w-none mb-8 border rounded-md p-6 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100 prose-headings:text-gray-100 prose-p:text-gray-200' 
                : 'bg-gray-50 border-gray-200 prose-slate'
            }`}>
              {report && <ReactMarkdown>{report}</ReactMarkdown>}
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                className={`px-4 py-2 border rounded-md font-medium transition-colors ${
                  darkMode 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setStep(3)}
              >
                Indietro
              </button>
              <div className="flex space-x-4">
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
                  onClick={downloadPDF}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Scarica PDF
                </button>
                <button
                  className={`px-6 py-3 rounded-md font-medium transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={resetApp}
                >
                  Ricomincia
                </button>
              </div>
            </div>
          </div>
        )}
          <div className={`text-center text-sm mt-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>AutoLabo v1.0 - Trasforma registrazioni audio in relazioni strutturate</p>
          <p className="mt-1">Powered by Whisper, Ollama e tecnologie di elaborazione del linguaggio naturale</p>
        </div>
      </div>
    </main>
  );
}
