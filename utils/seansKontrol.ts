// Dosya: utils/seansKontrol.ts

export const isPiyasaAcik = (): boolean => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const turkeyNow = new Date(utcMillis + 3 * 60 * 60 * 1000);
  const day = turkeyNow.getDay();

  if (day === 0 || day === 6) return false;

  const minutes = turkeyNow.getHours() * 60 + turkeyNow.getMinutes();
  return minutes >= 10 * 60 && minutes < 18 * 60;
};