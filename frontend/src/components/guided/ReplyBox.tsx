import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FieldError } from '@/components/common/FieldError';

/**
 * Texto livre para o Claude: como escrever no terminal, sem lista branca de caracteres (caminhos com `\` e `:`,
 * código, Markdown são respostas normais). O backend tira os caracteres de controlo (ADR 0020 ponto 7) e corta
 * nos 8000 — o mesmo limite aqui.
 */
const replySchema = z.object({ text: z.string().trim().min(1, 'Escreve uma resposta.').max(8000, 'Até 8000 caracteres.') });
type ReplyValues = z.infer<typeof replySchema>;

type ReplyBoxProps = {
  busy: boolean;
  /** Devolve true se foi enviada — só então a caixa se limpa. */
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
};

/** A caixa de resposta quando o Claude terminou o turno à espera de texto. `Ctrl+Enter` envia. */
export function ReplyBox({ busy, onSend, placeholder = 'Responde ao Claude…' }: ReplyBoxProps) {
  const form = useForm<ReplyValues>({ resolver: zodResolver(replySchema), defaultValues: { text: '' } });
  const submit = form.handleSubmit(async ({ text }) => {
    if (await onSend(text)) form.reset({ text: '' });
  });

  return (
    <form className="card p-3 flex flex-col gap-2" onSubmit={(event) => void submit(event)} noValidate aria-label="Responder ao Claude">
      <Controller
        name="text"
        control={form.control}
        render={({ field }) => (
          <Input.TextArea
            {...field}
            id="guided-reply"
            autoFocus
            aria-label="A tua resposta"
            autoSize={{ minRows: 3, maxRows: 12 }}
            maxLength={8000}
            disabled={busy}
            placeholder={placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        )}
      />
      <FieldError id="guided-reply-error" name="text" errors={form.formState.errors} />
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-3">
          <span className="kbd">Ctrl+Enter</span> envia
        </span>
        <Button type="primary" htmlType="submit" loading={busy}>
          Enviar
        </Button>
      </div>
    </form>
  );
}
