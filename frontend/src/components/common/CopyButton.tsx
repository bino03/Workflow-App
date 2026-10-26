import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { notificationService } from '@/services/general/notificationService';

/** Quanto tempo o botão mostra "Copiado" antes de voltar a "Copiar". */
const COPIED_MS = 1500;

type CopyButtonProps = { text: string; label?: string };

/** Copia o texto tal como está (o Markdown cru); a confirmação é o próprio botão, sem notificação. */
export function CopyButton({ text, label = 'Copiar' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Fora de um contexto seguro (http num IP da rede) o browser não expõe a área de transferência.
      notificationService.error('Erro', 'Não foi possível copiar.');
    }
  };

  return (
    <Button size="small" type="text" icon={copied ? <CheckOutlined className="text-success" /> : <CopyOutlined />} onClick={() => void copy()}>
      {copied ? 'Copiado' : label}
    </Button>
  );
}
