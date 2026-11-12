export type TaxParameterCategory = 'IVA' | 'Ingresos Brutos' | 'Ganancias' | 'Otros';

export interface TaxParameter {
  id: string;
  category: TaxParameterCategory;
  name: string;
  jurisdiction: string;
  value: number | null;
  unit: 'porcentaje' | 'importe';
  effectiveFrom: string;
  source: string;
  notes: string;
  status: 'vigente' | 'revisar';
  updatedAt: string;
}

export interface TaxParameterHistory {
  id: string;
  parameterId: string;
  parameterName: string;
  action: 'creado' | 'modificado' | 'eliminado';
  changedAt: string;
  previousValue?: number | null;
  newValue?: number | null;
  previousEffectiveFrom?: string;
  newEffectiveFrom?: string;
  source?: string;
}

export const DEFAULT_TAX_PARAMETERS: TaxParameter[] = [
  { id: 'iva-21', category: 'IVA', name: 'IVA general', jurisdiction: 'Nacional', value: 21, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: 'Valor de referencia precargado; confirmar en ARCA antes de utilizar.', notes: 'No determina por sí solo el tratamiento fiscal de cada operación.', status: 'revisar', updatedAt: '2026-11-12' },
  { id: 'iva-105', category: 'IVA', name: 'IVA reducido', jurisdiction: 'Nacional', value: 10.5, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: 'Valor de referencia precargado; confirmar en ARCA antes de utilizar.', notes: 'Aplicación según actividad y operación alcanzada.', status: 'revisar', updatedAt: '2026-11-12' },
  { id: 'iva-27', category: 'IVA', name: 'IVA diferencial', jurisdiction: 'Nacional', value: 27, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: 'Valor de referencia precargado; confirmar en ARCA antes de utilizar.', notes: 'Aplicación según servicio y condiciones legales.', status: 'revisar', updatedAt: '2026-11-12' },
  { id: 'iibb-caba', category: 'Ingresos Brutos', name: 'Alícuota de referencia', jurisdiction: 'CABA (AGIP)', value: null, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: '', notes: 'Completar según actividad, régimen y padrón del contribuyente.', status: 'revisar', updatedAt: '2026-11-12' },
  { id: 'iibb-pba', category: 'Ingresos Brutos', name: 'Alícuota de referencia', jurisdiction: 'Buenos Aires (ARBA)', value: null, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: '', notes: 'Completar según actividad, régimen y padrón del contribuyente.', status: 'revisar', updatedAt: '2026-11-12' },
  { id: 'ganancias', category: 'Ganancias', name: 'Parámetro a definir', jurisdiction: 'Nacional', value: null, unit: 'porcentaje', effectiveFrom: '2026-01-01', source: '', notes: 'No existe una única alícuota general para todas las retenciones y percepciones.', status: 'revisar', updatedAt: '2026-11-12' },
];
