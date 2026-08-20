import { buildConsultationPanel } from './consultation-panel.mjs';

export function diagnoseConsultation(input = {}) {
  if (!input.height500 && !input.moisture850 && !input.precipitation72) {
    return { title: '综合天气会商', status: 'fallback', message: '数据不足' };
  }

  return buildConsultationPanel({
    height500: input.height500 || null,
    moisture850: input.moisture850 || null,
    precipitation72: input.precipitation72 || null
  });
}

export function createConsultationResult(input = {}) {
  return diagnoseConsultation(input);
}

export function safeConsultation(input = {}) {
  try {
    return diagnoseConsultation(input);
  } catch (error) {
    return { title: '综合天气会商', status: 'fallback', message: '数据不足' };
  }
}
