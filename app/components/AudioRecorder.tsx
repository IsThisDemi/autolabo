'use client';

import React, { useState, useEffect } from 'react';

interface AudioRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRecordingComplete: (audioBlob: Blob) => void;
  darkMode?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  onRecordingComplete,
  darkMode = false
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  // Stili condizionali per la dark mode
  const buttonBgActive = darkMode ? 'bg-red-700' : 'bg-red-600';
  const buttonBgInactive = darkMode ? 'bg-blue-700' : 'bg-blue-600';
  const buttonHoverActive = darkMode ? 'hover:bg-red-800' : 'hover:bg-red-700';
  const buttonHoverInactive = darkMode ? 'hover:bg-blue-800' : 'hover:bg-blue-700';
  const textColor = 'text-white';
  
  const displayBgColor = darkMode ? 'bg-gray-800' : 'bg-gray-100';
  const displayTextColor = darkMode ? 'text-gray-300' : 'text-gray-700';

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      setRecordingTime(0);
      timerId = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerId) {
      clearInterval(timerId);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRecording]);

  useEffect(() => {
    const setupMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            setAudioChunks(prev => [...prev, event.data]);
          }
        });
        
        recorder.addEventListener('stop', () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
          onRecordingComplete(audioBlob);
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
          setAudioChunks([]);
        });
        
        setMediaRecorder(recorder);
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    };
    
    setupMediaRecorder();
    
    return () => {
      mediaRecorder?.stream?.getTracks().forEach(track => track.stop());
    };
  }, [onRecordingComplete]);

  useEffect(() => {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'inactive') {
      mediaRecorder.start();
      setAudioChunks([]);
    } else if (!isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, [isRecording, mediaRecorder]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className={`p-3 ${displayBgColor} rounded-md w-24 text-center mb-2`}>
        <span className={`font-mono text-lg ${displayTextColor}`}>
          {formatTime(recordingTime)}
        </span>
      </div>
      
      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        className={`px-6 py-3 rounded-full font-medium transition-colors flex items-center
          ${isRecording ? buttonBgActive : buttonBgInactive} 
          ${isRecording ? buttonHoverActive : buttonHoverInactive} 
          ${textColor}`}
      >
        {isRecording ? (
          <>
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Stop Registrazione
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Inizia Registrazione
          </>
        )}
      </button>
      
      {!isRecording && (
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Premi il pulsante per iniziare la registrazione
        </p>
      )}
    </div>
  );
};

export default AudioRecorder;
