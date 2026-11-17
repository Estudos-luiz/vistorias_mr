import { db, segredoIgual, intervaloMes, cache } from '../lib/comum.js';

// Apaga TODAS as vistorias de um mês. Não tem volta.
//   POST /api/apagar   corpo: { "mes": "AAAA-MM", "confirmar": "AAAA-MM" }
// Exige a senha do administrador (cabeçalho x-admin-password) e que "confirmar" seja igual a "mes".

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'Use POST' });

  const senhaEsperada = process.env.ADMIN_PASSWORD;
  if (!senhaEsperada) return res.status(500).json({ ok: false, erro: 'ADMIN_PASSWORD não configurada no servidor' });

  if (!segredoIgual(req.headers['x-admin-password'], senhaEsperada)) {
    await esperar(600);
    return res.status(401).json({ ok: false, erro: 'Senha incorreta' });
  }

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch { return res.status(400).json({ ok: false, erro: 'JSON inválido' }); }
  }
  corpo = corpo && typeof corpo === 'object' ? corpo : {};

  const mes = String(corpo.mes || '');
  const faixa = intervaloMes(mes);
  if (!faixa) return res.status(400).json({ ok: false, erro: 'Mês inválido (use AAAA-MM)' });
  if (String(corpo.confirmar || '') !== mes) return res.status(400).json({ ok: false, erro: 'A confirmação não confere com o mês' });

  try {
    const sql = db();
    const rows = await sql`
      with apagadas as (
        delete from vistorias
         where criado_em >= ${faixa.ini.toISOString()}::timestamptz
           and criado_em <  ${faixa.fim.toISOString()}::timestamptz
        returning 1
      )
      select count(*)::int as n from apagadas`;
    cache.clear();
    return res.status(200).json({ ok: true, mes, apagadas: rows[0] ? rows[0].n : 0 });
  } catch (e) {
    console.error('Erro ao apagar:', e);
    return res.status(500).json({ ok: false, erro: 'Erro ao apagar no banco' });
  }
}
