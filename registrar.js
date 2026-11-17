import { db, segredoIgual, limparNome } from '../lib/comum.js';

// Recebe as vistorias enviadas pelo script do Tampermonkey.
// O script manda o corpo como texto (text/plain) para não gerar a chamada extra de "preflight" do CORS.
// Corpo: { "chave": "...", "itens": [ { id, operador, resultado: "ok"|"bad", bloqueada, placa, cor, uf, sessao, t } ] }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'Use POST' });

  const chaveEsperada = process.env.INGEST_KEY;
  if (!chaveEsperada) return res.status(500).json({ ok: false, erro: 'INGEST_KEY não configurada no servidor' });

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch { return res.status(400).json({ ok: false, erro: 'JSON inválido' }); }
  }
  if (!corpo || typeof corpo !== 'object') return res.status(400).json({ ok: false, erro: 'Corpo vazio' });

  if (!segredoIgual(corpo.chave, chaveEsperada)) return res.status(401).json({ ok: false, erro: 'Chave inválida' });

  const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 100) : [];
  const agora = Date.now();
  const validos = [];

  for (const it of itens) {
    if (!it || typeof it !== 'object') continue;
    const id = txt(it.id, 60);
    const operador = limparNome(it.operador);
    const resultado = it.resultado === 'ok' ? 'aprovada' : it.resultado === 'bad' ? 'recusada' : '';
    if (!/^[A-Za-z0-9_.:-]{6,60}$/.test(id) || !operador || !resultado) continue;

    // Relógio do computador do operador pode estar errado: se fugir muito, usa a hora do servidor.
    let t = Number(it.t);
    if (!Number.isFinite(t) || t < agora - 36 * 3600e3 || t > agora + 5 * 60e3) t = agora;

    validos.push({
      id,
      operador,
      placa: txt(it.placa, 10).toUpperCase(),
      resultado,
      bloqueada: resultado === 'recusada' && !!it.bloqueada,
      cor: txt(it.cor, 30),
      uf: txt(it.uf, 30),
      sessao: txt(it.sessao, 30),
      criado: new Date(t).toISOString()
    });
  }

  if (validos.length) {
    try {
      const sql = db();
      await sql.transaction(
        validos.map(
          (v) => sql`
            insert into vistorias (id, operador, placa, resultado, bloqueada, cor, uf, sessao, criado_em)
            values (${v.id}, ${v.operador}, ${v.placa}, ${v.resultado}, ${v.bloqueada}, ${v.cor}, ${v.uf}, ${v.sessao}, ${v.criado}::timestamptz)
            on conflict (id) do nothing`
        )
      );
    } catch (e) {
      console.error('Erro ao gravar no banco:', e);
      return res.status(500).json({ ok: false, erro: 'Erro ao gravar no banco' });
    }
  }

  return res.status(200).json({ ok: true, recebidos: validos.length, ignorados: itens.length - validos.length });
}
