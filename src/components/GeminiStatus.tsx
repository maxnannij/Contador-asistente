import React, { useEffect, useState, useCallback } from 'react';

type StatusKind = 'loading' | 'ok' | 'saturated' | 'error' | 'unknown';

interface StatusPayload {
  status: StatusKind | string;
  available?: boolean;
  message?: string;
  checkedAt?: string;
}

const POLL_MS = 90_000; // cada 90 segundos

export const GeminiStatus: React.FC = () => {
  const [kind, setKind] = useState<StatusKind>('loading');
  const [message, setMessage] = useState('Verificando Gemini...');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/gemini-status', { method: 'GET' });
      const data: StatusPayload = await res.json().catch(() => ({}));

      if (data.status === 'ok' || data.available === true) {
        setKind('ok');
        setMessage(data.message || 'Gemini disponible');
      } else if (data.status === 'saturated') {
        setKind('saturated');
        setMessage(data.message || 'Gemini saturado');
      } else {
        setKind('error');
        setMessage(data.message || 'Gemini no disponible');
      }
      setCheckedAt(data.checkedAt || new Date().toISOString());
    } catch {
      setKind('unknown');
      setMessage('No se pudo verificar el estado');
      setCheckedAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  const color =
    kind === 'ok'
      ? 'bg-emerald-500'
      : kind === 'saturated'
      ? 'bg-rose-500'
      : kind === 'loading'
      ? 'bg-slate-300'
      : 'bg-amber-400';

  const pulse = kind === 'ok' || kind === 'loading' ? 'animate-pulse' : '';

  const label =
    kind === 'ok'
      ? 'IA lista'
      : kind === 'saturated'
      ? 'IA saturada'
      : kind === 'loading'
      ? 'Verificando...'
      : 'IA con problemas';

  const timeLabel = checkedAt
    ? new Date(checkedAt).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <button
      type="button"
      onClick={() => {
        setKind('loading');
        setMessage('Verificando Gemini...');
        check();
      }}
      title={`${message}${timeLabel ? ` · Última: ${timeLabel}` : ''}\nClic para volver a chequear`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${color} ${pulse}`} />
      <span>{label}</span>
    </button>
  );
};
