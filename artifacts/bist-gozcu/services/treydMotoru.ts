// Dosya: services/treydMotoru.ts

import { Hisse } from "@/services/collectApi";

export type TreydSinyali = {
  sembol: string;
  fiyat: number;
  degisimYuzde: number;
  hacim: number;
  skor: number;
  etiket: "GÜÇLÜ ALIM" | "MOMENTUM KIRILIMI" | "TAKİP LİSTESİ";
};

export const calculateMedian = (values: number[]): number => {
  const validValues = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  if (validValues.length === 0) return 0;
  const middle = Math.floor(validValues.length / 2);
  return validValues.length % 2 === 0
    ? (validValues[middle - 1] + validValues[middle]) / 2
    : validValues[middle];
};

const getEtiket = (
  skor: number,
): TreydSinyali["etiket"] => {
  if (skor >= 2.5) return "GÜÇLÜ ALIM";
  if (skor >= 1.25) return "MOMENTUM KIRILIMI";
  return "TAKİP LİSTESİ";
};

export const getTop6Treyd = (hisseler: Hisse[]): TreydSinyali[] => {
  const medyanHacim = calculateMedian(hisseler.map((hisse) => hisse.hacim));
  if (medyanHacim <= 0) return [];

  return hisseler
    .map((hisse) => ({
      ...hisse,
      skor: hisse.degisimYuzde * 0.6 + (hisse.hacim / medyanHacim) * 0.4,
      etiket: getEtiket(
        hisse.degisimYuzde * 0.6 + (hisse.hacim / medyanHacim) * 0.4,
      ),
    }))
    .filter((hisse) => hisse.degisimYuzde > 0 && hisse.skor > 0)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, 6);
};