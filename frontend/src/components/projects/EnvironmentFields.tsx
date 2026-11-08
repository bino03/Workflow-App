import { DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { Control, FieldErrors } from 'react-hook-form';
import { SelectField, TextField } from './FormField';
import { ENVIRONMENT_KIND_LABEL } from './projectInfoFormat';
import type { ProjectInfoFormValues } from './projectInfoFormSchema';

const KIND_OPTIONS = Object.entries(ENVIRONMENT_KIND_LABEL).map(([value, label]) => ({ value, label }));

type EnvironmentTextKey = 'kind' | 'name' | 'url' | 'hosting' | 'version' | 'monthlyCost' | 'dashboardUrl' | 'logsUrl' | 'healthUrl';

type EnvironmentFieldsProps = {
  index: number;
  control: Control<ProjectInfoFormValues>;
  errors: FieldErrors<ProjectInfoFormValues>;
  hostingSuggestions: readonly string[];
  disabled: boolean;
  onRemove: () => void;
};

/** Os campos de um ambiente (produção, staging…) — repetidos por `useFieldArray` no formulário da ficha. */
export function EnvironmentFields({ index, control, errors, hostingSuggestions, disabled, onRemove }: EnvironmentFieldsProps) {
  const field = (key: EnvironmentTextKey) => `environments.${index}.${key}` as const;
  const id = (key: EnvironmentTextKey) => `pi-env-${index}-${key}`;
  const common = { control, errors, disabled };

  return (
    <fieldset className="m-0 p-4 border border-border rounded-md bg-surface-2 flex flex-col gap-3 min-w-0">
      <legend className="sr-only">Ambiente {index + 1}</legend>
      <div className="flex items-end gap-3">
        <SelectField {...common} name={field('kind')} id={id('kind')} label="Tipo" options={KIND_OPTIONS} className="w-[170px]" />
        <TextField {...common} name={field('name')} id={id('name')} label="Nome" className="flex-1" />
        <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Remover o ambiente ${index + 1}`} disabled={disabled} onClick={onRemove} className="mb-6" />
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <TextField {...common} name={field('url')} id={id('url')} label="URL" placeholder="https://…" mono />
        <TextField {...common} name={field('hosting')} id={id('hosting')} label="Hosting" suggestions={hostingSuggestions} />
        <TextField {...common} name={field('version')} id={id('version')} label="Branch / versão em produção" mono />
        <TextField {...common} name={field('monthlyCost')} id={id('monthlyCost')} label="Custo mensal (€)" placeholder="0,00" mono />
        <TextField {...common} name={field('dashboardUrl')} id={id('dashboardUrl')} label="Painel do hosting" placeholder="https://…" mono />
        <TextField {...common} name={field('logsUrl')} id={id('logsUrl')} label="Logs / monitorização" placeholder="https://…" mono />
        <TextField {...common} name={field('healthUrl')} id={id('healthUrl')} label="Health check (só guardado)" placeholder="https://…" mono />
      </div>
    </fieldset>
  );
}
