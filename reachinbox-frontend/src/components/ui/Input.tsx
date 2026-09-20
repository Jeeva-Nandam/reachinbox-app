import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef, useId } from "react";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapperProps {}

const fieldClasses = (hasError?: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm
   focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
   ${hasError ? "border-red-400" : "border-gray-300"}`;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, id, className = "", ...rest }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input ref={ref} id={fieldId} className={`${fieldClasses(!!error)} ${className}`} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className = "", ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea ref={ref} id={fieldId} className={`${fieldClasses(!!error)} ${className}`} {...rest} />
        {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, className = "", children, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <select ref={ref} id={fieldId} className={`${fieldClasses(!!error)} bg-white ${className}`} {...rest}>
          {children}
        </select>
        {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
