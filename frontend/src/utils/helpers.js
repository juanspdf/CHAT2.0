// Formatear fecha
export const formatDate = (date) => {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Formatear tamaño de archivo
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// Validar formato de PIN
export const isValidPin = (pin) => {
  return /^\d{4,}$/.test(pin);
};

// Validar nickname
export const isValidNickname = (nickname) => {
  if (!nickname || typeof nickname !== 'string') return false;
  const trimmed = nickname.trim();
  return trimmed.length >= 3 && trimmed.length <= 20;
};
