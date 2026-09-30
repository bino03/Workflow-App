import { useRef, useState } from 'react';
import { Alert, Button, Drawer, Select, Space } from 'antd';
import { DRAWER_WIDTH } from '@/config/drawer';
import type { ApiFieldError } from '@/errors/error.types';
import { ErrorHandler } from '@/errors/errorHandler';
import { notificationService } from '@/services/general/notificationService';
import { uploadSkill } from '@/services/libraryService';
import type { SkillEntry, StackEntry } from '@/types/library';

type UploadSkillDrawerProps = {
  open: boolean;
  onClose: () => void;
  stacks: StackEntry[];
  /** A entrada devolvida pelo upload entra na lista sem um segundo GET. */
  onUploaded: (entry: SkillEntry) => void;
};

const MAX_BYTES = 256 * 1024;

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * A única escrita da app na biblioteca do Workflow ([[ADR 0014]]): acrescenta um `skill-*.md` a uma
 * stack que já existe. Sem React Hook Form — não há nada para validar do lado do cliente além de
 * "stack e ficheiro escolhidos" (o botão fica desativado), porque o que torna um ficheiro válido está
 * *dentro* dele e quem decide é o backend.
 */
export function UploadSkillDrawer({ open, onClose, stacks, onUploaded }: UploadSkillDrawerProps) {
  const [stackId, setStackId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const noStacks = stacks.length === 0;

  // Reabrir o drawer não deve mostrar o erro nem o ficheiro da tentativa anterior. Todo o fecho
  // (Cancelar, ✕, Esc, máscara, sucesso) passa por aqui, por isso não é preciso um efeito no `open`.
  const close = () => {
    setStackId(null);
    setFile(null);
    setDragging(false);
    setError(null);
    setFieldErrors([]);
    onClose();
  };

  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    setError(null);
    setFieldErrors([]);
    setFile(chosen);
  };

  const submit = async () => {
    if (!stackId || !file) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors([]);
    try {
      const entry = await uploadSkill(stackId, file);
      onUploaded(entry);
      notificationService.success('Skill adicionada.', `${entry.name} está agora na stack ${entry.stack ?? stackId}.`);
      close();
    } catch (e) {
      // O erro mostra-se aqui dentro, com o drawer aberto: o ficheiro escolhido não se perde.
      const data = ErrorHandler.handle(e, { showNotification: false });
      setError(ErrorHandler.getMessage(e));
      setFieldErrors(data?.fieldErrors ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      size={DRAWER_WIDTH.small}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Biblioteca</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Adicionar skill</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">O nome do ficheiro vem do frontmatter</span>
          <span className="flex-1" />
          <Space>
            <Button onClick={close} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="primary" loading={submitting} disabled={!stackId || !file} onClick={() => void submit()}>
              Enviar
            </Button>
          </Space>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {noStacks ? (
          <Alert
            type="warning"
            showIcon
            title="A biblioteca ainda não tem nenhuma stack"
            description={
              <>
                Uma skill vive sempre dentro de uma stack. Cria uma primeiro num terminal, com{' '}
                <span className="font-mono">/add-stack</span> na pasta do Workflow.
              </>
            }
          />
        ) : (
          <p className="m-0 text-[13.5px] leading-[21px] text-text-2">
            O ficheiro vai para a biblioteca partilhada do Workflow, dentro da stack escolhida. Não substitui
            nenhuma skill já existente.
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-text-3">Stack de destino</span>
          <Select
            placeholder="Escolhe uma stack"
            value={stackId}
            onChange={setStackId}
            disabled={noStacks || submitting}
            showSearch
            optionFilterProp="label"
            options={stacks.map((stack) => ({ value: stack.id, label: stack.name }))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-text-3">Ficheiro da skill</span>
          <button
            type="button"
            disabled={noStacks || submitting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files[0]);
            }}
            className={`w-full flex flex-col items-center gap-1.5 px-4 py-7 rounded-md border border-dashed text-center cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              dragging ? 'border-accent bg-surface-3' : 'border-border bg-surface-2 hover:bg-surface-3'
            }`}
          >
            {file ? (
              <>
                <span className="font-mono text-[13px] text-text-1 break-all">{file.name}</span>
                <span className="text-[12px] text-text-3">
                  {formatSize(file.size)}
                  {file.size > MAX_BYTES && ' · acima do limite de 256 KB'}
                </span>
                <span className="text-[12px] text-accent">Escolher outro</span>
              </>
            ) : (
              <>
                <span className="text-[13.5px] text-text-2">Arrasta um ficheiro .md para aqui</span>
                <span className="text-[12px] text-text-3">ou clica para escolher · até 256 KB</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={(event) => {
              choose(event.target.files?.[0]);
              // Sem isto, escolher o mesmo ficheiro outra vez não dispara o onChange.
              event.target.value = '';
            }}
          />
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
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
      </div>
    </Drawer>
  );
}
