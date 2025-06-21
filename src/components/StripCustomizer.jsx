// src/components/StripCustomizer.jsx
import React from 'react';
import StripPreview from './StripPreview';

const StripCustomizer = ({ photos, selectedTemplate, onTemplateChange }) => {
  // Template options
  const templates = [
    { id: 'default', name: 'Classic Strip', icon: '📑' },
    { id: 'hearts', name: 'Love Hearts', icon: '💖' }
  ];

  return (
    <div className="strip-customizer">
      <h3>Choose a Template</h3>
      
      <div className="customizer-container">
        <div className="template-options">
          {templates.map(template => (
            <button
              key={template.id}
              className={`template-option ${selectedTemplate === template.id ? 'selected' : ''}`}
              onClick={() => onTemplateChange(template.id)}
            >
              <span className="template-icon">{template.icon}</span>
              <span className="template-name">{template.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StripCustomizer;