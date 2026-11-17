-- Rode este arquivo UMA vez no "SQL Editor" do Neon.

create table if not exists vistorias (
  id          text primary key,                 -- gerado pelo script; evita contar a mesma vistoria duas vezes
  operador    text not null,                    -- nome padronizado em MAIÚSCULAS
  placa       text,
  resultado   text not null check (resultado in ('aprovada', 'recusada')),
  bloqueada   boolean not null default false,   -- true = recusada + bloqueada
  cor         text,
  uf          text,
  sessao      text,
  criado_em   timestamptz not null,             -- horário em que o operador clicou em Finalizar
  recebido_em timestamptz not null default now()
);

create index if not exists vistorias_criado_em_idx on vistorias (criado_em);

-- Para apagar dados antigos quando o espaço apertar (exemplo: mais de 90 dias):
-- delete from vistorias where criado_em < now() - interval '90 days';
