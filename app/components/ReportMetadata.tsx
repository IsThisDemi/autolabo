'use client';

import React from 'react';

interface ReportMetadataProps {
  title: string;
  author: string;
  institution: string;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  onInstitutionChange: (value: string) => void;
  darkMode?: boolean;
}

const ReportMetadata: React.FC<ReportMetadataProps> = ({ 
  title,
  author,
  institution,
  onTitleChange,
  onAuthorChange,
  onInstitutionChange,
  darkMode = false
}) => {
  const bgColor = darkMode ? 'bg-slate-800/70' : 'bg-gray-50';
  const titleColor = darkMode ? 'text-white' : 'text-gray-800';
  const labelColor = darkMode ? 'text-slate-300' : 'text-gray-700';
  const inputBg = darkMode ? 'bg-slate-700' : 'bg-white';
  const inputBorder = darkMode ? 'border-slate-600' : 'border-gray-300';
  const inputText = darkMode ? 'text-white' : 'text-gray-700';
  
  return (
    <div className={`mb-4 p-4 rounded-md ${bgColor}`}>
      <h3 className={`text-base font-medium mb-3 ${titleColor}`}>
        Informazioni Report
      </h3>
      
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="report-title" className={`block text-sm font-medium mb-1 ${labelColor}`}>
            Titolo del report
          </label>
          <input
            type="text"
            id="report-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border ${inputBg} ${inputBorder} ${inputText} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors`}
            placeholder="Inserisci un titolo per il report"
          />
        </div>
        
        <div>
          <label htmlFor="report-author" className={`block text-sm font-medium mb-1 ${labelColor}`}>
            Nome autore
          </label>
          <input
            type="text"
            id="report-author"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border ${inputBg} ${inputBorder} ${inputText} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors`}
            placeholder="Inserisci il tuo nome"
          />
        </div>
        
        <div>
          <label htmlFor="report-institution" className={`block text-sm font-medium mb-1 ${labelColor}`}>
            Istituzione
          </label>
          <input
            type="text"
            id="report-institution"
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border ${inputBg} ${inputBorder} ${inputText} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors`}
            placeholder="Inserisci il nome dell'istituzione"
          />
        </div>
      </div>
    </div>
  );
};

export default ReportMetadata;
