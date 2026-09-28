import { get, type FieldErrors, type FieldValues } from 'react-hook-form';

type FieldErrorProps<T extends FieldValues> = {
  /** Liga o texto ao campo por `aria-describedby`. */
  id?: string;
} & (
  | { name: string; errors: FieldErrors<T>; message?: never }
  /** Mensagem que não vem do Zod (ex. erro devolvido pela API ao submeter). */
  | { message: string | null | undefined; name?: never; errors?: never }
);

/**
 * Erro por baixo de um campo — forms-and-validation.md §4. Sem i18n (ADR 0007): mostra a mensagem
 * do schema tal como está, em PT. O ✕ dá forma ao erro, não só cor.
 */
export function FieldError<T extends FieldValues>({ id, ...props }: FieldErrorProps<T>) {
  const text: string | undefined =
    props.errors !== undefined ? get(props.errors, props.name)?.message : props.message ?? undefined;

  return (
    <div id={id} role="alert" className="min-h-6 pt-1.5 text-[13px] leading-[18px] text-error">
      {text && `✕ ${text}`}
    </div>
  );
}
