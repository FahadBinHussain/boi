'use client';

import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import MotionIcon from './MotionIcon';

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
  return (
    <div className={`form-control w-full mb-4 ${className}`}>
      <label htmlFor={id} className="label py-1">
        <span className="label-text font-semibold text-base-content">
          {label} {required && <span className="text-error">*</span>}
        </span>
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/50">
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
          className={`input input-bordered w-full bg-base-100 text-base-content ${
            icon ? 'pl-10' : ''
          } ${error ? 'input-error' : ''}`}
        />
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
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

export default FormInput;