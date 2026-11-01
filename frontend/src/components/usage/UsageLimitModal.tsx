import { Button, Modal } from 'antd';
import { useRef, useState } from 'react';
import { useUsage } from '@/hooks/useUsage';
import { acknowledge, pendingWarning, resetText, type AcknowledgedWarnings, type LimitWarning } from './usageLimits';

// Preferência do dispositivo, no localStorage (docs/database.md): cada browser avisa uma vez por janela.
const KEY = 'workflow-app.usage-warnings';

function readAcknowledged(): AcknowledgedWarnings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as AcknowledgedWarnings) : {};
  } catch {
    return {};
  }
}

/**
 * Aviso de limite da quota (90% e 100% da janela de 5 h, 90% da semanal), em qualquer página da app. Só fecha
 * com OK — sem ✕, sem clicar fora, sem Esc — para não passar despercebido a meio de uma conversa.
 */
export function UsageLimitModal() {
  const { usage, now } = useUsage();
  const [acknowledged, setAcknowledged] = useState(readAcknowledged);
  const okRef = useRef<HTMLButtonElement>(null);
  const warning = pendingWarning(usage, acknowledged, now);
  // O que se mostra fica igual durante a animação de fecho, depois do OK (aí `warning` já é null).
  const [shown, setShown] = useState<LimitWarning | null>(null);
  if (warning && (warning.key !== shown?.key || warning.window !== shown.window)) setShown(warning);

  const handleOk = () => {
    if (!warning) return;
    const next = acknowledge(acknowledged, warning);
    setAcknowledged(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // localStorage indisponível: o OK dura só esta visita.
    }
  };

  const pct = shown ? Math.round(shown.window.usedPct) : 0;
  const exhausted = shown !== null && shown.threshold >= 100;

  return (
    <Modal
      open={warning !== null}
      width={440}
      title={shown && (exhausted ? `Esgotaste a ${shown.label}` : `Chegaste aos ${pct}% da ${shown.label}`)}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      afterOpenChange={(open) => {
        if (open) okRef.current?.focus();
      }}
      footer={
        <Button ref={okRef} type="primary" onClick={handleOk}>
          OK
        </Button>
      }
    >
      {shown && (
        <div className="flex flex-col gap-3 text-text-2" data-usage-warning={shown.key}>
          <p className="m-0">
            {exhausted
              ? 'O Claude deixa de responder nos terminais até a janela repor.'
              : 'Está perto do limite: uma conversa longa pode parar a meio.'}
          </p>
          <p className="m-0 rounded-md px-3 py-2 border border-[var(--wfa-state-wait-border)] bg-[var(--wfa-state-wait-subtle)] text-warning font-medium">
            {pct}% usado · {resetText(shown.window.resetsAt, now)}
          </p>
        </div>
      )}
    </Modal>
  );
}
