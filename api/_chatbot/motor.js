// Elige el motor del asistente: «guiado» (por defecto, sin IA y gratis: menús y opciones cerradas) o «claude»
// (entiende texto libre; requiere ANTHROPIC_API_KEY, de pago por uso). Variable CHATBOT_MOTOR.
export const MOTOR = (process.env.CHATBOT_MOTOR || 'guiado').toLowerCase();

const cargar = () => (MOTOR === 'claude' ? import('./nucleo.js') : import('./guiado.js'));

export async function atender(quien, texto) {
  return (await cargar()).atender(quien, texto);
}

export async function reiniciarConversacion(contacto) {
  return (await cargar()).reiniciarConversacion(contacto);
}

export const motorListo = () => MOTOR !== 'claude' || Boolean(process.env.ANTHROPIC_API_KEY);
