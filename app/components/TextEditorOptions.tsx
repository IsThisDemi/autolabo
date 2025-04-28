'use client';

import React from 'react';

interface TextEditorOptionsProps {
  onCleanFiller: () => void;
  onCorrectGrammar: () => void;
  correctionStatus: 'idle' | 'loading' | 'success' | 'error';
  darkMode?: boolean;
}

const TextEditorOptions: React.FC<TextEditorOptionsProps> = ({ 
  onCleanFiller, 
  onCorrectGrammar,
  correctionStatus,
  darkMode = false
}) => {
  // Stato per il componente
  const isLoading = correctionStatus === 'loading';
  
  // Stili basati sulla modalità
  const bgColor = darkMode ? 'bg-slate-800' : 'bg-gray-100';
  const buttonBgNormal = darkMode ? 'bg-slate-700' : 'bg-white';
  const buttonBgHover = darkMode ? 'hover:bg-slate-600' : 'hover:bg-gray-50';
  const buttonBgDisabled = darkMode ? 'bg-slate-900' : 'bg-gray-200';
  const textColor = darkMode ? 'text-gray-300' : 'text-gray-700';
  const textColorDisabled = darkMode ? 'text-gray-600' : 'text-gray-500';
  
  const getGrammarStatusClasses = () => {
    if (correctionStatus === 'success') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (correctionStatus === 'error') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    } else if (correctionStatus === 'loading') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  return (
    <div className={`mb-3 p-4 rounded-md ${bgColor} flex flex-col md:flex-row gap-3`}>
      <div className="flex-grow">
        <h3 className={`font-medium mb-2 ${textColor}`}>Strumenti di modifica</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCleanFiller}
            disabled={isLoading}
            className={`flex items-center text-sm px-3 py-2 rounded-md border transition-colors ${
              isLoading
                ? `${buttonBgDisabled} ${textColorDisabled} cursor-not-allowed border-transparent`
                : `${buttonBgNormal} ${textColor} ${buttonBgHover} border-gray-300`
            }`}
            title="Rimuove parole come 'ehm', 'allora', 'cioè', ecc."
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rimuovi parti inutili
          </button>
          
          <button
            onClick={onCorrectGrammar}
            disabled={isLoading}
            className={`flex items-center text-sm px-3 py-2 rounded-md border transition-colors ${
              isLoading
                ? `${buttonBgDisabled} ${textColorDisabled} cursor-not-allowed border-transparent`
                : `${buttonBgNormal} ${textColor} ${buttonBgHover} border-gray-300`
            }`}
            title="Corregge automaticamente la grammatica e lo stile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Correzione grammatica
          </button>
        </div>
      </div>
      
      {correctionStatus !== 'idle' && (
        <div className={`px-3 py-1 rounded-md text-sm flex items-center ${getGrammarStatusClasses()}`}>
          {correctionStatus === 'loading' && (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Correzione in corso...
            </>
          )}
          {correctionStatus === 'success' && (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Correzione completata!
            </>
          )}
          {correctionStatus === 'error' && (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Errore nella correzione
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TextEditorOptions;
