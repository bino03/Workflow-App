import { AutoComplete, Input, Select } from 'antd';
import { Controller, get, type Control, type FieldErrors, type FieldPathByValue } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import type { ProjectInfoFormValues } from './projectInfoFormSchema';

type StringPath = FieldPathByValue<ProjectInfoFormValues, string>;

type FieldProps = {
  control: Control<ProjectInfoFormValues>;
  errors: FieldErrors<ProjectInfoFormValues>;
  name: StringPath;
  /** Liga o rótulo, o campo e o erro (`aria-describedby`). */
  id: string;
  label: string;
  disabled?: boolean;
  className?: string;
};

type TextFieldProps = FieldProps & {
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'date';
  /** Com opções, o campo é um `AutoComplete`: sugere, mas aceita qualquer texto. */
  suggestions?: readonly string[];
};

type SelectFieldProps = FieldProps & {
  options: readonly { value: string; label: string }[];
};

function FieldShell({ id, label, className = '', children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <label htmlFor={id} className="text-[12.5px] text-text-3 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Um campo de texto do formulário da ficha: `Controller` (nunca `register`, forms-and-validation §2.1) + erro por baixo. */
export function TextField({ control, errors, name, id, label, disabled, className, placeholder, mono, type = 'text', suggestions }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const status = get(errors, name) ? 'error' : undefined;
          const common = { id, disabled, placeholder, status, 'aria-describedby': `${id}-error`, className: mono ? 'font-mono text-[12.5px]' : undefined } as const;
          return suggestions ? (
            <AutoComplete
              {...field}
              {...common}
              className="w-full"
              options={suggestions.map((value) => ({ value }))}
              filterOption={(input, option) => option?.value.toLowerCase().includes(input.toLowerCase()) ?? false}
            />
          ) : (
            <Input {...field} {...common} type={type} />
          );
        }}
      />
      <FieldError id={`${id}-error`} name={name} errors={errors} />
    </FieldShell>
  );
}

export function SelectField({ control, errors, name, id, label, disabled, className, options }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => <Select {...field} id={id} disabled={disabled} options={[...options]} aria-describedby={`${id}-error`} />}
      />
      <FieldError id={`${id}-error`} name={name} errors={errors} />
    </FieldShell>
  );
}
