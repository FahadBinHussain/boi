'use client';

import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import MotionIcon from './MotionIcon';

interface FormTextareaProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  error?: string;
  className?: string;
  rows?: number;
}

const FormTextarea = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  error,
  className = '',
  rows = 4
}: FormTextareaProps) => {
  return (
    <div className={`form-control w-full mb-4 ${className}`}>
      <label htmlFor={id} className="label py-1">
        <span className="label-text font-semibold text-base-content">
          {label} {required && <span className="text-error">*</span>}
        </span>
      </label>
      <div className="relative">
        <textarea
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          rows={rows}
          className={`textarea textarea-bordered w-full bg-base-100 text-base-content ${
            error ? 'textarea-error' : ''
          }`}
        />
        {error && (
          <div className="absolute top-3 right-3 flex items-center pointer-events-none">
            <MotionIcon animation="wiggle" trigger="always">
              <FiAlertCircle className="h-5 w-5 text-error" />
            </MotionIcon>
          </div>
        )}
      </div>
      {error && (
        <label className="label py-1">
          <span className="label-text-alt text-error">{error}</span>
        </label>
      )}
    </div>
  );
};

export default FormTextarea;