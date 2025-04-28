'use client';

import React, { useEffect, useState } from 'react';
import { getMemoryStats, getOllamaStatus, MemoryStats, OllamaStatus } from '../utilities/api';

interface SystemStatusProps {
  darkMode?: boolean;
}

export default function SystemStatus({ darkMode = false }: SystemStatusProps) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchStatus = async () => {
      try {
        const [memStats, oStatus] = await Promise.all([
          getMemoryStats(),
          getOllamaStatus()
        ]);
        
        if (isMounted) {
          setMemoryStats(memStats);
          setOllamaStatus(oStatus);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching system status:', err);
        if (isMounted) {
          setError('Impossibile ottenere lo stato del sistema');
          setLoading(false);
        }
      }
    };
    
    // Solo se stiamo caricando i dati per la prima volta
    if (loading && !memoryStats && !ollamaStatus) {
      fetchStatus();
    }
    
    // Aggiorna ogni 10 secondi ma senza mostrare il caricamento
    const intervalId = setInterval(async () => {
      try {
        const [memStats, oStatus] = await Promise.all([
          getMemoryStats(),
          getOllamaStatus()
        ]);
        
        if (isMounted) {
          setMemoryStats(memStats);
          setOllamaStatus(oStatus);
        }
      } catch (err) {
        console.error('Error updating system status:', err);
      }
    }, 10000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [loading, memoryStats, ollamaStatus]);

  const bgColor = darkMode ? 'bg-gray-800' : 'bg-gray-100';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-700';
  const cardBgColor = darkMode ? 'bg-gray-700' : 'bg-white';
  const cardTextColor = darkMode ? 'text-gray-300' : 'text-gray-800';
  const footerTextColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (loading && !memoryStats) {
    return (
      <div className={`${bgColor} p-4 rounded-lg shadow-sm animate-pulse`}>
        <h3 className={`text-lg font-semibold ${textColor} mb-3`}>Caricamento stato sistema...</h3>
        <div className="h-20 bg-gray-600 opacity-30 rounded"></div>
      </div>
    );
  }

  if (error && !memoryStats) {
    return (
      <div className={`bg-red-100 p-4 rounded-lg shadow-sm ${darkMode ? 'bg-opacity-20' : ''}`}>
        <h3 className="text-lg font-semibold text-red-700">Errore</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const getGpuMemoryText = () => {
    if (!memoryStats) return 'N/A';
    
    const { gpu } = memoryStats.memory;
    
    if (typeof gpu === 'string') {
      return gpu;
    }
    
    if (gpu && typeof gpu === 'object') {
      return `${gpu.free.toFixed(2)}GB liberi / ${gpu.total.toFixed(2)}GB totali`;
    }
    
    return 'N/A';
  };

  return (
    <div className={`${bgColor} p-4 rounded-lg shadow-sm mb-6`}>
      <h3 className={`text-lg font-semibold ${textColor} mb-3`}>Stato Sistema</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GPU Status */}
        <div className={`p-3 ${cardBgColor} rounded-md shadow-sm`}>
          <h4 className={`font-medium ${cardTextColor} mb-2`}>GPU</h4>
          <p className="text-sm">
            <span className="font-semibold">Disponibilità:</span>{' '}
            <span className={memoryStats?.models.cuda_available ? 'text-green-600' : 'text-red-600'}>
              {memoryStats?.models.cuda_available ? 'Disponibile' : 'Non disponibile'}
            </span>
          </p>
          <p className="text-sm">
            <span className="font-semibold">Memoria:</span>{' '}
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{getGpuMemoryText()}</span>
          </p>
          <p className="text-sm">
            <span className="font-semibold">Dispositivo:</span>{' '}
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{memoryStats?.models.device || 'N/A'}</span>
          </p>
        </div>
        
        {/* Models Status */}
        <div className={`p-3 ${cardBgColor} rounded-md shadow-sm`}>
          <h4 className={`font-medium ${cardTextColor} mb-2`}>Modelli</h4>
          <p className="text-sm">
            <span className="font-semibold">Whisper:</span>{' '}
            <span className={memoryStats?.models.whisper_loaded ? 'text-green-600' : (darkMode ? 'text-gray-400' : 'text-gray-600')}>
              {memoryStats?.models.whisper_loaded ? 'Caricato' : 'Non caricato'}
            </span>
          </p>
          <p className="text-sm">
            <span className="font-semibold">Ollama:</span>{' '}
            <span className={ollamaStatus?.status === 'online' ? 'text-green-600' : 'text-red-600'}>
              {ollamaStatus?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </p>
          {ollamaStatus?.status === 'online' && (
            <p className="text-sm">
              <span className="font-semibold">Modello LLM:</span>{' '}
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{ollamaStatus?.current_model?.name || 'Non disponibile'}</span>
            </p>
          )}
        </div>
      </div>
      
      <div className={`mt-4 text-xs ${footerTextColor}`}>
        <p>Le funzionalità di trascrizione audio (Whisper) e correzione/generazione testo (Ollama) 
           utilizzano la memoria GPU in modo alternato per evitare esaurimento memoria.</p>
      </div>
    </div>
  );
}
