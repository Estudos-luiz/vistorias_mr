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

export function mesSP() {
  return hojeSP().slice(0, 7);
}

// Valida e devolve o intervalo [ini, fim) do dia (AAAA-MM-DD) ou do mês (AAAA-MM) em horário de Brasília.
export function intervaloDia(dia) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(dia))) return null;
  const ini = new Date(`${dia}T00:00:00-03:00`);
  return { ini, fim: new Date(ini.getTime() + 24 * 3600 * 1000) };
}

export function intervaloMes(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5));
  const ny = m === 12 ? a + 1 : a, nm = m === 12 ? 1 : m + 1;
  return {
    ini: new Date(`${mes}-01T00:00:00-03:00`),
    fim: new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00-03:00`)
  };
}

// Guarda o resultado da tabela por alguns segundos (compartilhado entre resumo e apagar).
export const cache = new Map();
