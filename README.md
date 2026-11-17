# Painel de Vistorias (Vercel + Neon)

Recebe as vistorias enviadas pelo script do Tampermonkey e mostra a tabela do administrador
(Nome, Aprovados, Reprovados, Bloqueados, Total_Geral), atualizando sozinha.

```
Tampermonkey (cada operador) --POST--> /api/registrar --> Neon (Postgres)
Página do administrador (/) ---GET---> /api/resumo   <-- Neon
```

## Estrutura

| Arquivo | Para que serve |
|---|---|
| `public/index.html` | Página do administrador (pede senha) |
| `api/registrar.js` | Recebe as vistorias do script (protegido por chave) |
| `api/resumo.js` | Devolve a tabela do dia (protegido por senha) |
| `lib/comum.js` | Conexão com o Neon e funções comuns |
| `schema.sql` | Cria a tabela no Neon (rodar uma vez) |

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string **pooled** do Neon (host com `-pooler`). Ex.: `postgresql://usuario:senha@ep-xxxx-pooler.regiao.aws.neon.tech/neondb?sslmode=require`. Se você conectar o Neon pela integração da Vercel, ela já cria essa variável. |
| `INGEST_KEY` | Chave secreta de envio. A mesma que vai no script (`CFG.chave`). |
| `ADMIN_PASSWORD` | Senha para abrir a página do administrador. |

Depois de criar ou mudar variáveis, faça um novo deploy (Deployments → ⋯ → Redeploy).

## Passo a passo

1. **Neon:** abra o SQL Editor do seu projeto, cole o conteúdo de `schema.sql` e execute.
2. **Neon:** nas configurações de compute da branch, deixe o tamanho máximo em **0,25 CU** (para as 100 horas do plano grátis durarem) e mantenha a suspensão automática ligada.
3. **GitHub:** crie um repositório **privado** e envie estes arquivos.
4. **Vercel:** Add New → Project → escolha o repositório. Não precisa mudar nenhuma configuração de build.
5. **Vercel:** cadastre as 3 variáveis acima e faça o deploy.
6. **Script:** no `script mr v3.0.txt`, troque `servidor` pelo endereço do seu projeto na Vercel e `chave` pelo mesmo valor de `INGEST_KEY`.
7. Abra o endereço do projeto, digite a senha e acompanhe.

## Testar o envio sem o script

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/registrar \
  -H "Content-Type: text/plain" \
  -d '{"chave":"SUA_INGEST_KEY","itens":[{"id":"teste-0001","operador":"teste","resultado":"ok","placa":"ABC1D23","t":'$(date +%s)'000}]}'
```

Resposta esperada: `{"ok":true,"recebidos":1,"ignorados":0}`. A linha "TESTE" deve aparecer no painel.
Para apagar o teste: `delete from vistorias where operador = 'TESTE';` no SQL Editor do Neon.

## Observações

- Reprovados não inclui bloqueados (igual à consulta do banco da empresa). Total = Aprovados + Reprovados + Bloqueados.
- O mesmo `id` nunca é gravado duas vezes, então reenvios do script não duplicam vistorias.
- A página só atualiza sozinha com a aba visível, no dia de hoje e entre 06:30 e 21:00 (Brasília). Isso evita manter o banco ligado à toa.
- O botão "Zerar" do script só limpa o contador local; o que já foi enviado continua no banco.
- A chave de envio fica dentro do script, então quem abrir o script consegue vê-la. Serve para uso interno; se vazar, troque `INGEST_KEY` na Vercel e o `chave` no script.
- Para liberar espaço: `delete from vistorias where criado_em < now() - interval '90 days';`
