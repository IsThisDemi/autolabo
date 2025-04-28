'use client';

import React from 'react';

interface TextareaComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  minHeight?: string;
  darkMode?: boolean;
}

const TextareaComponent: React.FC<TextareaComponentProps> = ({
  value,
  onChange,
  placeholder = "Inserisci il testo qui...",
  label,
  className = "",
  minHeight = "300px",
  darkMode = false
}) => {
  const labelColor = darkMode ? 'text-gray-300' : 'text-gray-700';
  const bgColor = darkMode ? 'bg-gray-800' : 'bg-white';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-300';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-900';
  const placeholderColor = darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400';
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className={`block text-sm font-medium mb-2 ${labelColor}`}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full p-3 border rounded-md
          ${bgColor} ${borderColor} ${textColor} ${placeholderColor}
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          font-mono text-sm transition-colors
        `}
        style={{ minHeight }}
      />
    </div>
  );
};

export default TextareaComponent;
