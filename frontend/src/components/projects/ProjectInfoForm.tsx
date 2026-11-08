import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { EnvironmentFields } from './EnvironmentFields';
import { SelectField, TextField } from './FormField';
import { LIFECYCLES, lifecycleLabel } from './projectInfoFormat';
import { MAX_ENVIRONMENTS, MAX_LINKS, newEnvironment, type ProjectInfoFormValues } from './projectInfoFormSchema';

const LIFECYCLE_OPTIONS = [{ value: '', label: 'Sem ciclo de vida' }, ...LIFECYCLES.map((value) => ({ value, label: lifecycleLabel(value) }))];

type ProjectInfoFormProps = {
  form: UseFormReturn<ProjectInfoFormValues>;
  hostingSuggestions: readonly string[];
  disabled: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 pb-2 text-[16px] leading-6 font-semibold text-text-1 border-b border-border">{title}</h3>
      {children}
    </section>
  );
}

/** Os campos da ficha de um projeto (spec informacao-dos-projetos §4.4). O `useForm` e os botões são do drawer. */
export function ProjectInfoForm({ form, hostingSuggestions, disabled }: ProjectInfoFormProps) {
  const {
    control,
    formState: { errors },
  } = form;
  const environments = useFieldArray({ control, name: 'environments' });
  const links = useFieldArray({ control, name: 'links' });
  const common = { control, errors, disabled };

  return (
    <form className="flex flex-col gap-7" onSubmit={(event) => event.preventDefault()} noValidate>
      <Section title="Ciclo de vida">
        <div className="grid grid-cols-2 gap-x-3">
          <SelectField {...common} name="lifecycle" id="pi-lifecycle" label="Estado" options={LIFECYCLE_OPTIONS} />
          <TextField {...common} name="client" id="pi-client" label="Cliente / dono" />
        </div>
      </Section>

      <Section title="Ambientes">
        {environments.fields.map((field, index) => (
          <EnvironmentFields
            key={field.id}
            index={index}
            control={control}
            errors={errors}
            hostingSuggestions={hostingSuggestions}
            disabled={disabled}
            onRemove={() => environments.remove(index)}
          />
        ))}
        <div>
          <Button
            icon={<PlusOutlined />}
            disabled={disabled || environments.fields.length >= MAX_ENVIRONMENTS}
            onClick={() => environments.append(newEnvironment(form.getValues('environments')))}
          >
            Adicionar ambiente
          </Button>
          <span className="ml-3 text-[12px] text-text-3">
            {environments.fields.length} de {MAX_ENVIRONMENTS}
          </span>
        </div>
      </Section>

      <Section title="Código e infra">
        <div className="grid grid-cols-2 gap-x-3">
          <TextField {...common} name="repoUrl" id="pi-repoUrl" label="Repositório" placeholder="https://…" mono className="col-span-2" />
          <TextField {...common} name="database" id="pi-database" label="Base de dados / serviços" />
          <TextField {...common} name="ci" id="pi-ci" label="CI/CD" />
          <TextField {...common} name="domainName" id="pi-domainName" label="Domínio" mono />
          <TextField {...common} name="domainRegistrar" id="pi-domainRegistrar" label="Registado em" />
          <TextField {...common} name="domainRenewsAt" id="pi-domainRenewsAt" label="Renova em" type="date" mono />
        </div>
      </Section>

      <Section title="Links">
        {links.fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-3">
            <TextField {...common} name={`links.${index}.label`} id={`pi-link-${index}-label`} label="Rótulo" className="w-[200px]" />
            <TextField {...common} name={`links.${index}.url`} id={`pi-link-${index}-url`} label="URL" placeholder="https://…" mono className="flex-1" />
            <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Remover o link ${index + 1}`} disabled={disabled} onClick={() => links.remove(index)} className="mt-[26px]" />
          </div>
        ))}
        <div>
          <Button icon={<PlusOutlined />} disabled={disabled || links.fields.length >= MAX_LINKS} onClick={() => links.append({ label: '', url: '' })}>
            Adicionar link
          </Button>
          <span className="ml-3 text-[12px] text-text-3">
            {links.fields.length} de {MAX_LINKS}
          </span>
        </div>
      </Section>

      <Section title="Notas">
        <div className="flex flex-col">
          <label htmlFor="pi-notes" className="text-[12.5px] text-text-3 mb-1.5">
            Notas livres
          </label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="pi-notes"
                disabled={disabled}
                autoSize={{ minRows: 4, maxRows: 14 }}
                maxLength={4000}
                status={errors.notes ? 'error' : undefined}
                aria-describedby="pi-notes-hint pi-notes-error"
              />
            )}
          />
          <FieldError id="pi-notes-error" name="notes" errors={errors} />
          <span id="pi-notes-hint" className="text-[12px] text-text-3">
            Não guardes passwords nem tokens aqui.
          </span>
        </div>
      </Section>
    </form>
  );
}
