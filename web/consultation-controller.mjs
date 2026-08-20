import { buildConsultationPanel } from './consultation-panel.mjs';

export function createConsultationResult(input = {}) {
  return buildConsultationPanel({
    height500: input.height500 || null,
    moisture850: input.moisture850 || null,
    precipitation72: input.precipitation72 || null
  });
}

export function safeConsultation(input = {}) {
  try {
    return createConsultationResult(input);
  } catch (error) {
    return { title: '综合天气会商', status: 'fallback' };
  }
}
