'use client';

import React, { useEffect, useState } from 'react';
import { fetchTemplates } from '../utilities/api';

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateChange: (templateId: string) => void;
  darkMode?: boolean;
}

interface Template {
  name: string;
  description: string;
  sections: string[];
  icon: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  selectedTemplate,
  onTemplateChange,
  darkMode = false
}) => {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getTemplates = async () => {
      try {
        const templatesData = await fetchTemplates();
        setTemplates(templatesData);
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento dei template');
      } finally {
        setLoading(false);
      }
    };

    getTemplates();
  }, []);

  const bgColor = darkMode ? 'bg-slate-800' : 'bg-gray-100';
  const titleColor = darkMode ? 'text-white' : 'text-gray-800';
  const cardBg = darkMode ? 'bg-slate-700' : 'bg-white';
  const cardHoverBg = darkMode ? 'hover:bg-slate-600' : 'hover:bg-blue-50';
  const cardBorderSelected = darkMode ? 'border-blue-500' : 'border-blue-500';
  const cardBorderNormal = darkMode ? 'border-slate-600' : 'border-gray-200';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-700';
  const descriptionColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <div className={`py-4 text-center ${bgColor} rounded-md p-4`}>
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full"
          aria-label="loading" role="status">
        </div>
        <p className="mt-2 text-gray-500">Caricamento template...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${bgColor} rounded-md p-4`}>
        <p className="text-red-500">Errore: {error}</p>
        <p className="text-sm mt-2">
          Utilizzando il template predefinito. I template personalizzati non sono disponibili.
        </p>
      </div>
    );
  }

  return (
    <div className={`${bgColor} rounded-md p-4`}>
      <h3 className={`text-base font-medium mb-3 ${titleColor}`}>Tipo di report</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(templates).map(([id, template]) => (
          <div
            key={id}
            className={`${cardBg} border-2 rounded-md p-3 cursor-pointer transition-colors ${cardHoverBg} ${
              selectedTemplate === id ? cardBorderSelected : cardBorderNormal
            }`}
            onClick={() => onTemplateChange(id)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">{template.icon}</span>
              <div>
                <h4 className={`font-medium ${textColor}`}>{template.name}</h4>
                <p className={`text-sm ${descriptionColor}`}>{template.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
