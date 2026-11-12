import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2, History, ExternalLink, CheckCircle2, RotateCcw } from 'lucide-react';
import type { TaxParameter, TaxParameterCategory, TaxParameterHistory } from '../types/taxParameters.ts';

interface Props {
  parameters: TaxParameter[];
  history: TaxParameterHistory[];
  onAdd: (parameter: TaxParameter) => void;
  onUpdate: (parameter: TaxParameter) => void;
  onDelete: (parameter: TaxParameter) => void;
  onReset: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const blankParameter = (): TaxParameter => ({
  id: \`tax-\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`,
  category: 'Ingresos Brutos',
  name: '',
  jurisdiction: 'CABA (AGIP)',
  value: null,
  unit: 'porcentaje',
  effectiveFrom: today(),
  source: '',
  notes: '',
  status: 'revisar',
  updatedAt: today(),
});

export const TaxSettings: React.FC<Props> = ({ parameters, history, onAdd, onUpdate, onDelete, onReset }) => {
  const [draft, setDraft] = useState<TaxParameter | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const filtered = useMemo(() => categoryFilter === 'Todas'
    ? parameters
    : parameters.filter((item) => item.category === categoryFilter), [parameters, categoryFilter]);

  const save = () => {
    if (!draft || !draft.name.trim() || !draft.jurisdiction.trim()) return;
    const normalized = { ...draft, name: draft.name.trim(), jurisdiction: draft.jurisdiction.trim(), source: draft.source.trim(), notes: draft.notes.trim(), updatedAt: today() };
    if (parameters.some((item) => item.id === normalized.id)) onUpdate(normalized);
    else onAdd(normalized);
    setDraft(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-950">
          <strong>Estos parámetros son una ayuda de referencia, no una liquidación tributaria.</strong>
          <p className="mt-1 text-xs leading-relaxed">Las alícuotas pueden depender de la actividad, jurisdicción, régimen, padrón y período. Los valores precargados de IVA están marcados para revisar; IIBB y Ganancias quedan sin valor hasta que la contadora los confirme. La aplicación no consulta automáticamente cambios normativos.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Parámetros impositivos</h2>
            <p className="text-xs text-slate-500 mt-1">Administrá valores, jurisdicciones y fechas desde las que se aplican.</p>
          </div>
          <button onClick={() => setDraft(blankParameter())} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Agregar parámetro
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-xs text-slate-600 font-medium" htmlFor="tax-category-filter">Filtrar:</label>
          <select id="tax-category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white">
            <option>Todas</option><option>IVA</option><option>Ingresos Brutos</option><option>Ganancias</option><option>Otros</option>
          </select>
          <span className="text-xs text-slate-400">{parameters.filter((p) => p.status === 'revisar').length} para revisar</span>
        </div>

        {draft && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="font-semibold text-sm text-slate-900">{parameters.some((item) => item.id === draft.id) ? 'Editar parámetro' : 'Nuevo parámetro'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-xs font-medium text-slate-700">Impuesto
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as TaxParameterCategory })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">
                  <option>IVA</option><option>Ingresos Brutos</option><option>Ganancias</option><option>Otros</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">Nombre del parámetro
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Alícuota actividad comercial" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-700">Jurisdicción
                <input value={draft.jurisdiction} onChange={(e) => setDraft({ ...draft, jurisdiction: e.target.value })} placeholder="Nacional, CABA, Buenos Aires..." className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-700">Valor
                <input type="number" min="0" step="0.0001" value={draft.value ?? ''} onChange={(e) => setDraft({ ...draft, value: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Dejar vacío si no está definido" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-700">Tipo de valor
                <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as TaxParameter['unit'] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">
                  <option value="porcentaje">Porcentaje (%)</option><option value="importe">Importe fijo ($)</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">Vigente desde
                <input type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">Fuente oficial / normativa
                <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="Pegá el enlace de ARCA, AGIP, ARBA o la resolución" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">Notas / condiciones de aplicación
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} placeholder="Actividad, régimen, excepciones, padrón..." className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                <input type="checkbox" checked={draft.status === 'revisar'} onChange={(e) => setDraft({ ...draft, status: e.target.checked ? 'revisar' : 'vigente' })} />
                Marcar como pendiente de revisión
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white">Cancelar</button>
              <button onClick={save} disabled={!draft.name.trim() || !draft.jurisdiction.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-40"><Save className="w-3.5 h-3.5" /> Guardar parámetro</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((parameter) => (
            <div key={parameter.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-slate-900">{parameter.name}</strong>
                    <span className="text-[10px] rounded-full bg-slate-100 px-2 py-1 text-slate-600">{parameter.category}</span>
                    {parameter.status === 'revisar'
                      ? <span className="text-[10px] rounded-full bg-amber-100 px-2 py-1 text-amber-800">Revisar</span>
                      : <span className="text-[10px] rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Confirmado</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{parameter.jurisdiction} · Vigente desde {parameter.effectiveFrom || 'sin fecha'}</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{parameter.value === null ? 'Sin definir' : \`\${parameter.value.toLocaleString('es-AR')} \${parameter.unit === 'porcentaje' ? '%' : '$'}\`}</p>
                  {parameter.notes && <p className="text-xs text-slate-500 mt-1">{parameter.notes}</p>}
                  {parameter.source && <a href={parameter.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline mt-2 break-all"><ExternalLink className="w-3 h-3" /> Fuente normativa / referencia</a>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setDraft({ ...parameter })} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50">Editar</button>
                  <button onClick={() => { if (confirm(\`¿Eliminar "\${parameter.name}"?\`)) onDelete(parameter); }} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No hay parámetros en esta categoría.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /><h3 className="font-bold text-sm text-slate-900">Historial de cambios</h3><span className="text-xs text-slate-400">({history.length})</span></div>
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-emerald-700 underline">{showHistory ? 'Ocultar' : 'Ver historial'}</button>
            <button onClick={() => setShowResetConfirm(true)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700"><RotateCcw className="w-3 h-3" /> Restaurar valores iniciales</button>
          </div>
        </div>
        {showResetConfirm && <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs">
          ¿Restaurar los parámetros iniciales? Se perderán los parámetros personalizados actuales.
          <div className="flex justify-end gap-2 mt-2"><button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 rounded border bg-white">Cancelar</button><button onClick={() => { onReset(); setShowResetConfirm(false); }} className="px-3 py-1.5 rounded bg-rose-600 text-white">Confirmar</button></div>
        </div>}
        {showHistory && <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
          {history.length === 0 && <p className="text-xs text-slate-500">Todavía no hay cambios registrados.</p>}
          {history.map((entry) => <div key={entry.id} className="text-xs border-b border-slate-100 pb-2">
            <div className="font-semibold text-slate-800">{entry.parameterName} · {entry.action}</div>
            <div className="text-slate-500">{new Date(entry.changedAt).toLocaleString('es-AR')} {entry.previousValue !== undefined ? \`· Antes: \${entry.previousValue ?? 'Sin definir'}\` : ''} {entry.newValue !== undefined ? \`· Ahora: \${entry.newValue ?? 'Sin definir'}\` : ''}</div>
            {entry.source && <div className="text-slate-400 break-all">{entry.source}</div>}
          </div>)}
        </div>}
      </div>

      <div className="text-[11px] text-slate-400 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Los cambios se guardan en este navegador y dispositivo. No se sincronizan automáticamente con otros equipos.</div>
    </div>
  );
};
