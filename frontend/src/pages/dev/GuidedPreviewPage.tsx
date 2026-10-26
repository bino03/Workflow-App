import { useState } from 'react';
import { GuidedFeed } from '@/components/guided/GuidedFeed';
import { PermissionCard } from '@/components/guided/PermissionCard';
import { QuestionCard } from '@/components/guided/QuestionCard';
import { ReplyBox } from '@/components/guided/ReplyBox';
import type { FeedEntry, Question } from '@/types/guided';

const AT = '2026-10-26T10:00:00.000Z';

/** Uma proposta como a do `/create`, com tudo o que o Markdown tem de aguentar — e HTML que não pode ser interpretado. */
const PROPOSAL = `## Proposta — GinasioTeste

**Destino:** \`C:\\Users\\dono\\projetos\\GinasioTeste\`

| Camada | Stack | Maturidade |
|---|---|---|
| backend | spring-boot | ✅ provada |
| frontend | react-vite-antd | ✅ provada |
| plataforma | supabase | 🟡 parcial |

- Skills incluídas: \`implement-todo\`, \`run\`, \`design-database\`
- Excluídas: \`add-file-upload\` — *sem ficheiros*

1. Esqueleto do blueprint
2. Camadas e skills

\`\`\`
GinasioTeste/
├── backend/
└── frontend/
\`\`\`

> Decisões em aberto: hosting.

<b>isto não é negrito</b> <img src="x" onerror="alert(1)"> <script>alert(2)</script>

[Documentação](https://example.com) · ![imagem remota](https://example.com/pixel.png)`;

const ANSWERED: Question[] = [
  { question: 'Que forma tem a app?', header: 'Forma', multiSelect: false, options: [{ label: 'Back-office web interno (Recommended)', description: '' }] },
  { question: 'Que capacidades precisa?', header: 'Capacidades', multiSelect: true, options: [{ label: 'Guardar ficheiros', description: '' }] },
];

const FEED: FeedEntry[] = [
  { id: 'brief', type: 'user-text', text: 'Uma app para gerir as reservas das aulas do meu ginásio.\nSó para mim e para os dois funcionários.', at: AT },
  { id: 'a1', type: 'activity', summary: 'Leu 6 ficheiros · Fez 2 pesquisas', count: 8, at: AT },
  { id: 'a2', type: 'assistant-text', markdown: 'Falta-me saber duas coisas do **bloco A**:\n\n> **A4.** Que papéis existem?\n> **A7.** Que dois ecrãs?', at: AT },
  { id: 'u1', type: 'user-text', text: 'Dono e funcionários.\nO horário da semana e a ficha do sócio.', at: AT },
  { id: 'q1', type: 'question', questions: ANSWERED, answers: { 'Que forma tem a app?': 'Back-office web interno (Recommended)', 'Que capacidades precisa?': 'Guardar ficheiros, Notificações' }, at: AT },
  { id: 'p1', type: 'permission', summary: 'Bash: git rev-parse --short HEAD', decision: 'allow', at: AT },
  { id: 'p2', type: 'permission', summary: 'Write: C:\\Users\\dono\\Desktop\\fora.txt', decision: 'deny', at: AT },
  { id: 'a3', type: 'assistant-text', markdown: PROPOSAL, at: AT },
  { id: 'q-pending', type: 'question', questions: ANSWERED, answers: null, at: AT },
];

const QUESTIONS: Question[] = [
  {
    question: 'Que forma tem a app?',
    header: 'Forma',
    multiSelect: false,
    options: [
      { label: 'Back-office web interno (Recommended)', description: 'Só a equipa usa, num portátil.' },
      { label: 'SaaS para vários clientes', description: 'Um produto, com contas por cliente.' },
      { label: 'Site público + back-office', description: '' },
    ],
  },
  {
    question: 'Que capacidades precisa?',
    header: 'Capacidades',
    multiSelect: true,
    options: [
      { label: 'Guardar ficheiros', description: 'Fotos, PDFs, comprovativos.' },
      { label: 'Notificações in-app', description: '' },
      { label: 'Trabalho agendado', description: 'Tarefas que correm sozinhas.' },
    ],
  },
];

/** Só em dev (/_guided): os componentes da sessão guiada com dados falsos (spec novo-projeto-guiado, passo 7). */
export default function GuidedPreviewPage() {
  const [lastAction, setLastAction] = useState('nenhuma');
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-[760px] p-6 flex flex-col gap-6">
        <div>
          <div className="kicker">Pré-visualização</div>
          <div className="text-display">Sessão guiada</div>
        </div>
        <GuidedFeed entries={FEED} />
        <QuestionCard questions={QUESTIONS} busy={busy} onSubmit={(answers) => setLastAction(`answer ${JSON.stringify(answers)}`)} />
        <QuestionCard questions={[QUESTIONS[0]!]} busy={busy} onSubmit={(answers) => setLastAction(`answer-one ${JSON.stringify(answers)}`)} />
        <PermissionCard
          tool="Bash"
          summary={'git init "C:\\Users\\dono\\projetos\\GinasioTeste"'}
          busy={busy}
          onDecide={(decision) => setLastAction(`permission ${decision}`)}
        />
        <ReplyBox
          busy={busy}
          onSend={async (text) => {
            setLastAction(`message ${JSON.stringify(text)}`);
            return true;
          }}
        />
        <label className="flex items-center gap-2 text-text-3 text-[12px]">
          <input id="toggle-busy" type="checkbox" checked={busy} onChange={(event) => setBusy(event.target.checked)} /> busy
        </label>
        <div id="last-action" className="text-text-3 font-mono text-[12px] break-all">
          Última ação: {lastAction}
        </div>
      </div>
    </div>
  );
}
