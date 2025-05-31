import React from 'react';
import { IconType } from 'react-icons';

interface FormTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  icon?: IconType;
  helpText?: string;
  rows?: number;
  className?: string;
}

const FormTextarea: React.FC<FormTextareaProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  icon: Icon,
  helpText,
  rows = 4,
  className = '',
}) => {
  return (
    <div className={`form-group ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        <div className="flex items-center">
          {Icon && <Icon className="mr-2 h-4 w-4 text-indigo-500" />}
          {label} {required && <span className="text-red-500 ml-1">*</span>}
        </div>
      </label>
      <textarea
        id={id}
        rows={rows}
        className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
          ${error ? "border-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          font-medium text-opacity-100`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          opacity: 1,
          color: 'var(--input-text)',
          backgroundColor: 'var(--input-bg)',
        }}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      {helpText && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default FormTextarea; 