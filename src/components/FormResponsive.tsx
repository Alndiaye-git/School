import React from 'react';
import { useResponsive } from '../hooks/useResponsive';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'textarea' | 'number' | 'email' | 'password';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  width?: 'full' | 'half' | 'third';
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

interface FormResponsiveProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  isLoading?: boolean;
  error?: string;
  title?: string;
  className?: string;
}

const FormResponsive: React.FC<FormResponsiveProps> = ({
  fields,
  values,
  onChange,
  onSubmit,
  submitLabel = "Enregistrer",
  onCancel,
  cancelLabel = "Annuler",
  isLoading = false,
  error,
  title,
  className = ""
}) => {
  const { isMobile } = useResponsive();

  const renderField = (field: FormField) => {
    const value = values[field.name] || '';
    
    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      disabled: field.disabled || isLoading,
      placeholder: field.placeholder
    };

    switch (field.type) {
      case 'select':
        return (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
          >
            <option value="">Sélectionner...</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={4}
          />
        );
      
      default:
        return (
          <input
            {...commonProps}
            type={field.type}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            min={field.validation?.min}
            max={field.validation?.max}
            pattern={field.validation?.pattern}
          />
        );
    }
  };

  const getFieldWidth = (field: FormField) => {
    if (isMobile) return 'full';
    return field.width || 'full';
  };

  const getGridClass = () => {
    if (isMobile) return 'form-grid-mobile';
    return 'form-grid-desktop';
  };

  return (
    <div className={`form-responsive ${className}`}>
      <form onSubmit={onSubmit} className="responsive-form">
        {title && <h3 className="form-title">{title}</h3>}
        
        {error && (
          <div className="message error">
            {error}
          </div>
        )}
        
        <div className={getGridClass()}>
          {fields.map((field) => (
            <div 
              key={field.name} 
              className={`form-group form-group-${getFieldWidth(field)}`}
            >
              <label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              {renderField(field)}
              {field.validation?.message && (
                <small className="field-help">
                  {field.validation.message}
                </small>
              )}
            </div>
          ))}
        </div>
        
        <div className="form-actions">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="btn-secondary"
              disabled={isLoading}
            >
              {cancelLabel}
            </button>
          )}
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Chargement...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormResponsive;