'use client';

import React, { useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';

interface FormInputProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: string;
  className?: string;
  icon?: React.ReactNode;
}

const FormInput = ({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  error,
  className = '',
  icon
}: FormInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`mb-4 ${className}`}>
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={`relative rounded-md shadow-sm`}>
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            block w-full rounded-md sm:text-sm 
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5
            border ${error ? 'border-red-300 dark:border-red-700' : isFocused ? 'border-indigo-500 dark:border-indigo-400' : 'border-gray-300 dark:border-gray-600'} 
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400
            transition-colors
            ${error ? 'focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400' : ''}
          `}
        />
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <FiAlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default FormInput; 