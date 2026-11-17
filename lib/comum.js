import { neon } from '@neondatabase/serverless';
import { createHash, timingSafeEqual } from 'node:crypto';

let _sql;

// Conexão com o Neon (usa a variável DATABASE_URL; POSTGRES_URL também serve).
export function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    _sql = neon(url);
  }
  return _sql;
}

// Compara dois textos sem vazar informação pelo tempo de resposta.
export function segredoIgual(a, b) {
  const ha = createHash('sha256').update(String(a || '')).digest();
  const hb = createHash('sha256').update(String(b || '')).digest();
  return timingSafeEqual(ha, hb);
}

// "  julia   sales " -> "JULIA SALES"
export function limparNome(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR').slice(0, 40);
}

// Data de hoje no horário de Brasília (UTC-3, sem horário de verão desde 2019): AAAA-MM-DD
export function hojeSP() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
