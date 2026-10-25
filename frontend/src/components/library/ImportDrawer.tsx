import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AutoComplete, Button, Drawer, Input, Segmented, Select, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { DRAWER_WIDTH } from '@/config/drawer';
import type { ApiFieldError } from '@/errors/error.types';
import { ErrorHandler } from '@/errors/errorHandler';
import { getFolders } from '@/services/folderService';
import { notificationService } from '@/services/general/notificationService';
import { createImport, relativePathOf } from '@/services/importService';
import type { CreateImportBody, ImportKind, ImportView } from '@/types/imports';
import type { StackEntry } from '@/types/library';
import { IMPORT_FORM_DEFAULTS, type ImportFormValues, type ImportSourceType, importFormSchema } from './importFormSchema';

type ImportDrawerProps = {
  open: boolean;
  onClose: () => void;
  stacks: StackEntry[];
  /** A importação acabada de começar — a faixa da Biblioteca passa a segui-la. */
  onCreated: (view: ImportView) => void;
};

/** Os mesmos limites do backend (imports/stagingFiles.ts) — avisar antes de enviar. */
const MAX_FILES = 200;
const MAX_BYTES = 10 * 1024 * 1024;

const KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: 'skill', label: 'Skill' },
  { value: 'design', label: 'Design' },
  { value: 'stack', label: 'Stack' },
  { value: 'auto', label: 'Não sei' },
];

const SOURCE_OPTIONS: { value: ImportSourceType; label: string }[] = [
  { value: 'files', label: 'Ficheiros' },
  { value: 'url', label: 'URL' },
  { value: 'project', label: 'Projeto' },
  { value: 'text', label: 'Descrição' },
];

const LAYER_OPTIONS = ['backend', 'frontend', 'platform', 'desktop', 'fullstack'].map((value) => ({ value, label: value }));

type Question = {
  name: FieldPath<ImportFormValues>;
  label: string;
  type: 'input' | 'textarea' | 'layer' | 'stacks' | 'target';
  placeholder?: string;
};

/** O "Step 1" de cada skill do Workflow (docs/import-contract.md lá). Tudo opcional: vazio = a skill decide ou pergunta. */
const QUESTIONS: Record<ImportKind, Question[]> = {
  stack: [
    { name: 'stack.technology', label: 'Tecnologia', type: 'input', placeholder: 'Django + DRF' },
    { name: 'stack.layer', label: 'Camada', type: 'layer' },
    { name: 'stack.versions', label: 'Versões', type: 'input', placeholder: 'Python 3.13, Django 5.2' },
    { name: 'stack.pairsWith', label: 'Combina com', type: 'stacks' },
    { name: 'stack.conflictsWith', label: 'Incompatível com', type: 'stacks' },
    { name: 'stack.whenToChoose', label: 'Quando a escolherias', type: 'textarea' },
    { name: 'stack.whenNot', label: 'E quando não', type: 'textarea' },
  ],
  design: [
    { name: 'design.name', label: 'Nome', type: 'input', placeholder: 'Âmbar' },
    { name: 'design.character', label: 'Carácter, numa linha', type: 'input', placeholder: 'Escuro e denso, acento quente' },
    { name: 'design.suits', label: 'Serve para', type: 'textarea' },
    { name: 'design.notSuits', label: 'Não serve para', type: 'textarea' },
  ],
  skill: [
    { name: 'skill.target', label: 'Onde vive', type: 'target' },
    { name: 'skill.whenToUse', label: 'Quando se usa', type: 'textarea' },
  ],
  auto: [{ name: 'auto.notes', label: 'Notas para a skill', type: 'textarea', placeholder: 'O que achas que é, o que queres que entre…' }],
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldId = (name: string) => `import-${name.replace('.', '-')}`;

/**
 * Importar para a biblioteca do Workflow (ADR 0019): o quê, de onde, e as perguntas desse tipo. Quem faz a
 * triagem e escreve é a skill `/import` do Workflow, num terminal escondido — este drawer só monta o pedido.
 * O erro do backend aparece aqui dentro (forms-and-validation §4.1): o que se escolheu não se perde.
 */
export function ImportDrawer({ open, onClose, stacks, onCreated }: ImportDrawerProps) {
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    mode: 'onChange',
    defaultValues: IMPORT_FORM_DEFAULTS,
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = form;
  const kind = useWatch({ control, name: 'kind' });
  const sourceType = useWatch({ control, name: 'sourceType' });

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // As pastas recentes e favoritas sugerem a origem "Projeto"; escrever outro caminho também serve.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getFolders()
      .then((list) => !cancelled && setFolders([...list.favorites, ...list.recents].map((folder) => folder.path)))
      .catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const filesProblem =
    files.length > MAX_FILES
      ? `São ${files.length} ficheiros — o máximo é ${MAX_FILES}.`
      : totalBytes > MAX_BYTES
        ? `São ${formatSize(totalBytes)} — o máximo é 10 MB no total.`
        : null;
  const filesReady = sourceType !== 'files' || (files.length > 0 && filesProblem === null);

  // Todo o fecho passa por aqui (Cancelar, ✕, Esc, máscara, sucesso) — forms-and-validation §4.1.
  const close = () => {
    reset(IMPORT_FORM_DEFAULTS);
    setFiles([]);
    setDragging(false);
    setSubmitError(null);
    setFieldErrors([]);
    onClose();
  };

  const choose = (chosen: FileList | null | undefined) => {
    if (!chosen || chosen.length === 0) return;
    setSubmitError(null);
    setFieldErrors([]);
    setFiles([...chosen]);
  };

  const onSubmit = async (values: ImportFormValues) => {
    setSubmitError(null);
    setFieldErrors([]);
    const source: CreateImportBody['source'] =
      values.sourceType === 'url'
        ? { type: 'url', url: values.url }
        : values.sourceType === 'project'
          ? { type: 'project', path: values.projectPath }
          : values.sourceType === 'text'
            ? { type: 'text', text: values.text.trim() }
            : { type: 'files', paths: files.map(relativePathOf) };
    try {
      const view = await createImport({ kind: values.kind, source, answers: values[values.kind] }, values.sourceType === 'files' ? files : []);
      notificationService.success('Importação a correr', 'A skill do Workflow está a tratar dela. A faixa no topo diz quando estiver pronta.');
      onCreated(view);
      close();
    } catch (e) {
      const data = ErrorHandler.handle(e, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(e));
      setFieldErrors(data?.fieldErrors ?? []);
    }
  };

  const stackOptions = stacks.map((stack) => ({ value: stack.id, label: stack.name }));

  const renderQuestion = (question: Question) => (
    <div key={question.name} className="flex flex-col">
      <label htmlFor={fieldId(question.name)} className="text-[12.5px] text-text-3 mb-1.5">
        {question.label}
      </label>
      <Controller
        name={question.name}
        control={control}
        render={({ field }) => {
          const common = {
            id: fieldId(question.name),
            disabled: isSubmitting,
            status: errors[question.name.split('.')[0] as ImportKind] ? ('error' as const) : undefined,
          };
          switch (question.type) {
            case 'textarea':
              return <Input.TextArea {...common} value={field.value as string} onChange={field.onChange} onBlur={field.onBlur} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder={question.placeholder} />;
            case 'layer':
              return <Select {...common} value={(field.value as string) || undefined} onChange={(value: string | undefined) => field.onChange(value ?? '')} allowClear placeholder="A skill decide" options={LAYER_OPTIONS} />;
            case 'stacks':
              return <Select {...common} mode="multiple" value={field.value as string[]} onChange={field.onChange} placeholder="Nenhuma" options={stackOptions} optionFilterProp="label" />;
            case 'target':
              return (
                <Select
                  {...common}
                  value={field.value as string}
                  onChange={field.onChange}
                  showSearch
                  optionFilterProp="label"
                  options={[{ value: 'process', label: 'Processo (sem stack)' }, ...stackOptions]}
                />
              );
            default:
              return <Input {...common} value={field.value as string} onChange={field.onChange} onBlur={field.onBlur} maxLength={2000} placeholder={question.placeholder} />;
          }
        }}
      />
      <FieldError name={question.name} errors={errors} />
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={close}
      size={DRAWER_WIDTH.small}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Biblioteca</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Importar</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">Corre a skill /import do Workflow</span>
          <span className="flex-1" />
          <Space>
            <Button onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="primary" loading={isSubmitting} disabled={!isValid || !filesReady} onClick={() => void handleSubmit(onSubmit)()}>
              Importar
            </Button>
          </Space>
        </div>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()} noValidate>
        <p className="m-0 text-[13.5px] leading-[21px] text-text-2">
          A skill faz a triagem, escreve no Workflow e para sem commit. No fim vês o que mudou e aceitas ou descartas.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-text-3">O quê</span>
          <Controller
            name="kind"
            control={control}
            render={({ field }) => <Segmented block value={field.value} onChange={field.onChange} options={KIND_OPTIONS} disabled={isSubmitting} />}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-text-3">De onde</span>
          <Controller
            name="sourceType"
            control={control}
            render={({ field }) => <Segmented block value={field.value} onChange={field.onChange} options={SOURCE_OPTIONS} disabled={isSubmitting} />}
          />
        </div>

        {sourceType === 'files' && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => filesRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files);
              }}
              className={`w-full flex flex-col items-center gap-1.5 px-4 py-7 rounded-md border border-dashed text-center cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                dragging ? 'border-accent bg-surface-3' : 'border-border bg-surface-2 hover:bg-surface-3'
              }`}
            >
              {files.length > 0 ? (
                <>
                  <span className="font-mono text-[13px] text-text-1 break-all">
                    {files.length === 1 ? relativePathOf(files[0]!) : `${files.length} ficheiros`}
                  </span>
                  <span className="text-[12px] text-text-3">{formatSize(totalBytes)}</span>
                  <span className="text-[12px] text-accent">Escolher outros</span>
                </>
              ) : (
                <>
                  <span className="text-[13.5px] text-text-2">Arrasta ficheiros para aqui</span>
                  <span className="text-[12px] text-text-3">ou clica para escolher · até 200 ficheiros, 10 MB</span>
                </>
              )}
            </button>
            <Button type="link" size="small" className="self-start px-0" disabled={isSubmitting} onClick={() => folderRef.current?.click()}>
              Escolher uma pasta (um handoff do Claude Design, um projeto)…
            </Button>
            <FieldError message={filesProblem} />
            <input
              ref={filesRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                choose(event.target.files);
                // Sem isto, escolher os mesmos ficheiros outra vez não dispara o onChange.
                event.target.value = '';
              }}
            />
            <input
              ref={folderRef}
              type="file"
              className="hidden"
              // `webkitdirectory` não está nos tipos do React; dá o caminho relativo de cada ficheiro.
              {...{ webkitdirectory: '' }}
              onChange={(event) => {
                choose(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        )}

        {sourceType === 'url' && (
          <div className="flex flex-col">
            <label htmlFor="import-url" className="text-[12.5px] text-text-3 mb-1.5">
              Endereço
            </label>
            <Controller
              name="url"
              control={control}
              render={({ field }) => (
                <Input {...field} id="import-url" disabled={isSubmitting} placeholder="https://…" maxLength={2048} status={errors.url ? 'error' : undefined} aria-describedby="import-url-error" />
              )}
            />
            <FieldError id="import-url-error" name="url" errors={errors} />
          </div>
        )}

        {sourceType === 'project' && (
          <div className="flex flex-col">
            <label htmlFor="import-project" className="text-[12.5px] text-text-3 mb-1.5">
              Pasta
            </label>
            <Controller
              name="projectPath"
              control={control}
              render={({ field }) => (
                <AutoComplete
                  id="import-project"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  options={folders.map((path) => ({ value: path }))}
                  filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  placeholder="C:\…\projetos\App"
                  status={errors.projectPath ? 'error' : undefined}
                  aria-describedby="import-project-error"
                />
              )}
            />
            <FieldError id="import-project-error" name="projectPath" errors={errors} />
          </div>
        )}

        {sourceType === 'text' && (
          <div className="flex flex-col">
            <label htmlFor="import-text" className="text-[12.5px] text-text-3 mb-1.5">
              Descrição
            </label>
            <Controller
              name="text"
              control={control}
              render={({ field }) => (
                <Input.TextArea
                  {...field}
                  id="import-text"
                  disabled={isSubmitting}
                  autoSize={{ minRows: 4, maxRows: 10 }}
                  maxLength={8000}
                  placeholder="Ex.: uma stack para APIs em Go com chi e sqlc, para serviços pequenos…"
                  status={errors.text ? 'error' : undefined}
                  aria-describedby="import-text-error"
                />
              )}
            />
            <FieldError id="import-text-error" name="text" errors={errors} />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] text-text-3 uppercase tracking-[0.06em]">Perguntas da skill · opcionais</span>
          <span className="text-[12px] text-text-3 mb-2">O que deixares vazio, a skill decide — ou pergunta-te no terminal.</span>
          {QUESTIONS[kind].map(renderQuestion)}
        </div>

        {submitError && (
          <Alert
            type="error"
            showIcon
            title={submitError}
            description={
              fieldErrors.length > 0 && (
                <ul className="m-0 pl-4">
                  {fieldErrors.map(({ field, message }) => (
                    <li key={`${field}-${message}`}>
                      <span className="font-mono text-[12px]">{field}</span>: {message}
                    </li>
                  ))}
                </ul>
              )
            }
          />
        )}
      </form>
    </Drawer>
  );
}
