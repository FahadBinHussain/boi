import React from 'react';
import { IconType } from 'react-icons';

interface FormInputProps {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'url' | 'tel' | 'search' | 'date';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  icon?: IconType;
  helpText?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  icon: Icon,
  helpText,
  min,
  max,
  step,
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
      <input
        type={type}
        id={id}
        className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
          ${error ? "border-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          font-medium text-opacity-100`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        step={step}
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

export default FormInput; 