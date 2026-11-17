import { db, segredoIgual, hojeSP, intervaloDia, intervaloMes, cache } from '../lib/comum.js';

// Devolve a tabela do painel: uma linha por operador + total.
//   GET /api/resumo?dia=AAAA-MM-DD   -> um dia
//   GET /api/resumo?mes=AAAA-MM      -> um mês inteiro
// Protegido pela senha do administrador (cabeçalho x-admin-password).
// Guarda o resultado por 5 segundos para vários administradores não gerarem várias consultas ao banco.

const TTL_MS = 5000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, erro: 'Use GET' });

  const senhaEsperada = process.env.ADMIN_PASSWORD;
  if (!senhaEsperada) return res.status(500).json({ ok: false, erro: 'ADMIN_PASSWORD não configurada no servidor' });

  if (!segredoIgual(req.headers['x-admin-password'], senhaEsperada)) {
    await esperar(600); // atrapalha tentativas em sequência
    return res.status(401).json({ ok: false, erro: 'Senha incorreta' });
  }

  const q = req.query || {};
  let tipo = 'dia', periodo, faixa;
  if (q.mes) {
    faixa = intervaloMes(String(q.mes));
    if (faixa) { tipo = 'mes'; periodo = String(q.mes); }
  }
  if (!faixa) {
    periodo = String(q.dia || '');
    faixa = intervaloDia(periodo);
    if (!faixa) { periodo = hojeSP(); faixa = intervaloDia(periodo); }
  }

  const chave = tipo + ':' + periodo;
  const em = cache.get(chave);
  if (em && Date.now() - em.t < TTL_MS) return res.status(200).json(em.dados);

  try {
    const sql = db();
    const rows = await sql`
      select operador as nome,
             count(*) filter (where resultado = 'aprovada')::int                      as aprovados,
             count(*) filter (where resultado = 'recusada' and not bloqueada)::int    as reprovados,
             count(*) filter (where bloqueada)::int                                   as bloqueados,
             count(*)::int                                                            as total,
             max(criado_em)                                                           as ultima
        from vistorias
       where criado_em >= ${faixa.ini.toISOString()}::timestamptz
         and criado_em <  ${faixa.fim.toISOString()}::timestamptz
       group by operador
       order by total desc, operador`;

    const linhas = rows.map((r) => ({
      nome: r.nome,
      aprovados: r.aprovados,
      reprovados: r.reprovados,
      bloqueados: r.bloqueados,
      total: r.total,
      ultima: r.ultima ? new Date(r.ultima).toISOString() : null
    }));

    const total = linhas.reduce(
      (a, l) => ({
        aprovados: a.aprovados + l.aprovados,
        reprovados: a.reprovados + l.reprovados,
        bloqueados: a.bloqueados + l.bloqueados,
        total: a.total + l.total
      }),
      { aprovados: 0, reprovados: 0, bloqueados: 0, total: 0 }
    );

    const dados = { ok: true, tipo, periodo, atualizado: new Date().toISOString(), total, linhas };
    cache.set(chave, { t: Date.now(), dados });
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return res.status(200).json(dados);
  } catch (e) {
    console.error('Erro ao consultar o banco:', e);
    return res.status(500).json({ ok: false, erro: 'Erro ao consultar o banco' });
  }
}
