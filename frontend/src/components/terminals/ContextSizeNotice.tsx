/** A partir daqui o custo já se nota numa janela de 5 h, por isso aparece em destaque, com a sugestão do /compact. */
const HIGHLIGHT_FROM_TOKENS = 50_000;

function tokensText(tokens: number): string {
  return tokens < 1000 ? 'Menos de mil tokens' : `~${Math.round(tokens / 1000)} mil tokens`;
}

/**
 * O que custa continuar uma conversa noutra conta: o `claude` reenvia-a inteira, e a cache de prompts não passa de uma
 * conta para a outra (ADR 0027). `tokens` é `null` numa conversa ainda sem respostas gravadas.
 */
export function ContextSizeNotice({ tokens, accountLabel }: { tokens: number | null; accountLabel: string }) {
  if (tokens === null) {
    return (
      <p className="m-0 text-text-2" data-context-notice="empty">
        Esta conversa ainda não tem respostas gravadas, por isso não há contexto a reenviar para a conta {accountLabel}.
      </p>
    );
  }

  const cost = `${tokensText(tokens)} vão contar na quota de ${accountLabel} na primeira mensagem.`;
  if (tokens < HIGHLIGHT_FROM_TOKENS) {
    return (
      <p className="m-0 text-text-2" data-context-notice="normal">
        {cost}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-text-2" data-context-notice="high">
      <p className="m-0 rounded-md px-3 py-2 border border-[var(--wfa-state-wait-border)] bg-[var(--wfa-state-wait-subtle)] text-warning font-medium">
        {cost}
      </p>
      <p className="m-0">
        Para gastar menos, faz <span className="font-mono">/compact</span> antes de mudar, se a conta de origem ainda tiver quota.
      </p>
    </div>
  );
}
