import { GoogleGenAI } from '@google/genai';

function jsonResponse(statusCode: number, data: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function isTransient(err: any): boolean {
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.code || err?.error?.code;
  return (
    status === 503 ||
    status === 429 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    /high demand/i.test(msg) ||
    /UNAVAILABLE/i.test(msg) ||
    /try again later/i.test(msg)
  );
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(200, {
      status: 'error',
      available: false,
      message: 'GEMINI_API_KEY no configurada',
      checkedAt: new Date().toISOString(),
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Ping mínimo: casi sin tokens
    const response: any = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [{ text: 'Responde solo: ok' }] },
    });

    const text = (response?.text || '').toLowerCase();
    const ok = text.includes('ok') || text.length > 0;

    return jsonResponse(200, {
      status: ok ? 'ok' : 'error',
      available: ok,
      message: ok ? 'Gemini disponible' : 'Respuesta inesperada de Gemini',
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('gemini-status error:', err?.message || err);

    if (isTransient(err)) {
      return jsonResponse(200, {
        status: 'saturated',
        available: false,
        message: 'Gemini saturado (alta demanda)',
        checkedAt: new Date().toISOString(),
      });
    }

    return jsonResponse(200, {
      status: 'error',
      available: false,
      message: err?.message || 'Error al consultar Gemini',
      checkedAt: new Date().toISOString(),
    });
  }
};
