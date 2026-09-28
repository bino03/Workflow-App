import { FolderOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { App, Badge, Button, Checkbox, Drawer, Input, Popconfirm, Radio, Select, Switch, Table, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FieldError } from '@/components/common/FieldError';
import { ListActionDanger, ListActionPrimary, ListActionSecondary, ListActions } from '@/components/common/ListActions';
import { SectionCard } from '@/components/common/SectionCard';

const previewSchema = z.object({ name: z.string().min(1, 'Escreve um nome.') });

/** Só em dev (/_tokens): os tokens e os componentes comuns aplicados — tokens-and-colors.md. */
export default function TokenPreviewPage() {
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState('nenhuma');
  const { message } = App.useApp();
  const form = useForm({ resolver: zodResolver(previewSchema), defaultValues: { name: '' } });

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="kicker">Pré-visualização</div>
      <div className="text-display">Tokens Violeta</div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button type="primary" id="btn-primary">Primário</Button>
        <Button>Secundário</Button>
        <Button danger type="primary">Destrutivo</Button>
        <Tooltip title="Um tooltip" open><Button id="btn-tip">Tooltip</Button></Tooltip>
        <Badge count={5}><Button>Badge</Button></Badge>
        <Tag color="purple">Tag antd</Tag>
        <Switch defaultChecked /> <Checkbox defaultChecked>Check</Checkbox>
        <Radio.Group defaultValue="a" optionType="button" buttonStyle="solid" options={[{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]} />
        <Button onClick={() => message.success('Guardado')}>Toast</Button>
        {/* Popconfirm só para ver o popover com o tema — nas páginas usa-se useConfirm(). */}
        <Popconfirm title="Tens a certeza?"><Button>Popconfirm</Button></Popconfirm>
        <Button onClick={() => setOpen(true)}>Drawer</Button>
      </div>
      <div className="flex gap-2 items-center">
        <Input placeholder="Input" style={{ width: 200 }} />
        <Select defaultValue="x" style={{ width: 160 }} options={[{ value: 'x', label: 'Opção' }]} />
        <span className="kbd">Alt+1</span>
      </div>
      <div className="flex gap-2 items-center">
        <span className="tag-work"><span className="state-icon is-work" />A trabalhar</span>
        <span className="tag-wait"><span className="state-icon is-wait" />À tua espera</span>
        <span className="tag-stop"><span className="state-icon is-stop" />Terminado</span>
        <span className="tag-err"><span className="state-icon is-err" />Desligado</span>
        <span className="tag-ok">Provado</span><span className="tag-mid">Parcial</span><span className="tag-draft">Rascunho</span>
        <span className="tag">react</span>
      </div>
      <div className="flex gap-4 items-start">
        <div className="card p-4 w-96"><div className="card-kicker">Card</div><div className="card-title">Título</div><div className="card-body">Corpo</div><div className="card-meta">C:\dev\x</div></div>
        <SectionCard className="w-96" icon={<FolderOutlined />} kicker="Secção" title="Pasta" extra={<Button size="small">Editar</Button>}>
          <span className="font-mono">C:\dev\workflow-app</span>
        </SectionCard>
        <form id="preview-form" className="w-72" onSubmit={form.handleSubmit(() => undefined)} noValidate>
          <Controller name="name" control={form.control} render={({ field }) => <Input {...field} id="preview-name" placeholder="Nome" />} />
          <FieldError id="preview-name-error" name="name" errors={form.formState.errors} />
          <Button htmlType="submit" size="small">Validar</Button>
        </form>
      </div>
      <div id="last-action" className="text-text-3">Última ação: {lastAction}</div>
      <Table
        rowSelection={{}}
        pagination={false}
        rowKey="k"
        dataSource={[{ k: 1, n: 'workflow-app' }, { k: 2, n: 'api' }]}
        onRow={(record) => ({ onClick: () => setLastAction(`linha ${record.n}`) })}
        columns={[
          { title: 'Nome', dataIndex: 'n' },
          {
            title: '', key: 'actions', width: 170,
            render: (_, record) => (
              <ListActions>
                <ListActionPrimary onClick={() => setLastAction(`ver ${record.n}`)}>Ver detalhes</ListActionPrimary>
                <ListActionSecondary onClick={() => setLastAction(`editar ${record.n}`)}>Editar</ListActionSecondary>
                <ListActionDanger onClick={() => setLastAction(`eliminar ${record.n}`)}>Eliminar</ListActionDanger>
              </ListActions>
            ),
          },
        ]}
      />
      <Drawer open={open} onClose={() => setOpen(false)} title="Drawer" size={540}>Conteúdo</Drawer>
    </div>
  );
}
