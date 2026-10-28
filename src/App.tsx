/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, BillingParameters } from './types/receipt.ts';
import { INITIAL_RECEIPTS } from './data/initialReceipts.ts';
import {
  calculateReceiptSummary,
  calculateBillingParameters,
  exportReceiptsToCsv,
} from './utils/taxCalculations.ts';
import { exportToExcelWorkbook, copyReceiptsToClipboard } from './utils/excelExport.ts';
import { Header } from './components/Header.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { ReceiptUploader } from './components/ReceiptUploader.tsx';
import { ReceiptTable } from './components/ReceiptTable.tsx';
import { BillingParameterizer } from './components/BillingParameterizer.tsx';
import { FinancialAnalysis } from './components/FinancialAnalysis.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';

const STORAGE_KEY = 'contadoc_receipts_v2';
const BILLING_STORAGE_KEY = 'contadoc_billing_params_v1';

export default function App() {
  // Clear any legacy demo data from v1
  useEffect(() => {
    try {
      localStorage.removeItem('contadoc_receipts_v1');
    } catch {}
  }, []);

  // Initialize with an empty array so page starts 100% clean without demo values
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
    return [];
  });

  // Billing calculation parameters
  const [billingParams, setBillingParams] = useState<BillingParameters>(() => {
    try {
      const stored = localStorage.getItem(BILLING_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Error reading billing params from localStorage:', e);
    }
    return {
      targetMarginPct: 35,
      billingVatRate: 21,
      iibbEstimatedRate: 3.0,
      fixedOverhead: 0,
      targetNetProfit: 250000,
      mode: 'margin',
    };
  });

  const [activeTab, setActiveTab] = useState<'reporte' | 'facturar' | 'analisis'>('reporte');
  const [selectedMonth, setSelectedMonth] = useState<string>('todos');
  const [copied, setCopied] = useState(false);
  const [showDiscrepancyFilter, setShowDiscrepancyFilter] = useState(false);

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'view' | 'edit' | 'create';
    receipt: Receipt | null;
  }>({
    isOpen: false,
    mode: 'create',
    receipt: null,
  });

  // Save receipts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [receipts]);

  // Save billing params to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(billingParams));
    } catch (e) {
      console.error('Error saving billing params:', e);
    }
  }, [billingParams]);

  // Available months for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    receipts.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        months.add(r.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(months).sort().reverse();
  }, [receipts]);

  // Filtered by selected month
  const activeReceipts = useMemo(() => {
    if (selectedMonth === 'todos') return receipts;
    return receipts.filter((r) => r.date.startsWith(selectedMonth));
  }, [receipts, selectedMonth]);

  // Dynamic calculations
  const taxSummary = useMemo(() => {
    return calculateReceiptSummary(activeReceipts);
  }, [activeReceipts]);

  const billingSimulation = useMemo(() => {
    return calculateBillingParameters(taxSummary, billingParams);
  }, [taxSummary, billingParams]);

  // Handlers
  const handleReceiptsAdded = (newReceipts: Receipt[]) => {
    setReceipts((prev) => [...newReceipts, ...prev]);
  };

  const handleEditReceipt = (receipt: Receipt) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      receipt,
    });
  };

  const handleViewReceipt = (receipt: Receipt) => {
    setModalState({
      isOpen: true,
      mode: 'view',
      receipt,
    });
  };

  const handleDeleteReceipt = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este comprobante del reporte?')) {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleSaveReceipt = (saved: Receipt) => {
    setReceipts((prev) => {
      const index = prev.findIndex((r) => r.id === saved.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  const handleClearAll = () => {
    if (confirm('¿Deseas vaciar todos los comprobantes y limpiar la página?')) {
      setReceipts([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setSelectedMonth('todos');
    }
  };

  const handleLoadDemo = () => {
    setReceipts(INITIAL_RECEIPTS);
    setSelectedMonth('todos');
  };

  const handleExportExcel = () => {
    if (activeReceipts.length === 0) return;
    const periodName = selectedMonth === 'todos' ? 'Total_Periodos' : selectedMonth;
    exportToExcelWorkbook(
      activeReceipts,
      taxSummary,
      billingParams,
      billingSimulation,
      `ContaDoc_Reporte_Contable_${periodName}.xlsx`
    );
  };

  const handleExportCsv = () => {
    if (activeReceipts.length === 0) return;
    const csvContent = exportReceiptsToCsv(activeReceipts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ContaDoc_Comprobantes_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = async () => {
    if (activeReceipts.length === 0) return;
    const success = await copyReceiptsToClipboard(activeReceipts);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      
      {/* Header with Navigation and Export Controls */}
      <Header
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onCopyClipboard={handleCopyClipboard}
        onOpenManualModal={() =>
          setModalState({ isOpen: true, mode: 'create', receipt: null })
        }
        onClearAll={handleClearAll}
        copied={copied}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        availableMonths={availableMonths}
        receiptCount={receipts.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* KPI Summary Cards */}
        <SummaryCards
          summary={taxSummary}
          showDiscrepancyFilter={showDiscrepancyFilter}
          onFilterDiscrepancies={() => setShowDiscrepancyFilter(!showDiscrepancyFilter)}
        />

        {/* Tab 1: Detailed Receipts Report */}
        {activeTab === 'reporte' && (
          <div className="space-y-6">
            <ReceiptUploader
              onReceiptsAdded={handleReceiptsAdded}
              onOpenManualModal={() =>
                setModalState({ isOpen: true, mode: 'create', receipt: null })
              }
            />

            <ReceiptTable
              receipts={activeReceipts}
              onEditReceipt={handleEditReceipt}
              onDeleteReceipt={handleDeleteReceipt}
              onViewReceipt={handleViewReceipt}
              showDiscrepancyFilter={showDiscrepancyFilter}
            />

            {receipts.length === 0 && (
              <div className="text-center pt-2">
                <button
                  onClick={handleLoadDemo}
                  className="text-xs text-slate-400 hover:text-emerald-700 underline transition-colors cursor-pointer"
                >
                  ¿Deseas probar con datos contables de muestra? Cargar comprobantes de ejemplo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Billing Parameterizer & Estimation */}
        {activeTab === 'facturar' && (
          <BillingParameterizer
            summary={taxSummary}
            params={billingParams}
            simulation={billingSimulation}
            onUpdateParams={(newP) => setBillingParams((prev) => ({ ...prev, ...newP }))}
            onExportExcel={handleExportExcel}
            onGoToReport={() => setActiveTab('reporte')}
          />
        )}

        {/* Tab 3: Monthly Financial & Tax Analysis */}
        {activeTab === 'analisis' && (
          <FinancialAnalysis
            summary={taxSummary}
            receipts={activeReceipts}
          />
        )}

      </main>

      {/* Receipt Modal (Create / Edit / View) */}
      <ReceiptModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        receipt={modalState.receipt}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onSave={handleSaveReceipt}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span className="font-semibold text-slate-700">ContaDoc</span> — Software contable para procesamiento y desglose impositivo de comprobantes
          </div>
          <div className="flex items-center gap-4">
            <span>Soporta: AFIP / AGIP / ARBA / IVA / IIBB / Ganancias</span>
            <span>•</span>
            <button
              onClick={handleExportExcel}
              className="text-emerald-700 font-medium hover:underline cursor-pointer"
            >
              Exportar todo a Excel (.xlsx)
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
