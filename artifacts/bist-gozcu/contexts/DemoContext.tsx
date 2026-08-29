import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DemoSignalType =
  | "erken_hareket"
  | "gun_ici_izleme"
  | "gunluk_teyitli";

export type DemoSignalInput = {
  symbol: string;
  price: number;
  signalType: DemoSignalType;
  score: number;
  confirmations: number;
  dailyTrend: "up" | "sideways" | "down";
};

export type DemoMorningCandidate = {
  id: string;
  symbol: string;
  signalType: DemoSignalType;
  signalScore: number;
  confirmations: number;
  closePrice: number;
  closeAt: number;
  status: "bekliyor" | "işleme alındı" | "elenmiş";
  reason: string;
};

export type DemoPosition = {
  id: string;
  symbol: string;
  signalType: DemoSignalType;
  signalScore: number;
  confirmations: number;
  quantity: number;
  entryPrice: number;
  entryAt: number;
  entryFee: number;
  entrySlippage: number;
  exitPrice?: number;
  exitAt?: number;
  exitFee?: number;
  exitSlippage?: number;
  realizedPnl?: number;
  exitReason?: string;
};

export type DemoSignalSnapshot = {
  id: string;
  symbol: string;
  signalType: DemoSignalType;
  signalScore: number;
  confirmations: number;
  signalPrice: number;
  signalAt: number;
};

type DemoAccount = {
  initialBalance: number;
  cash: number;
  positions: DemoPosition[];
  closedTrades: DemoPosition[];
  signalSnapshots: DemoSignalSnapshot[];
  morningCandidates: DemoMorningCandidate[];
  processedSignalKeys: string[];
};

interface DemoContextType {
  account: DemoAccount;
  loading: boolean;
  executeSignals: (signals: DemoSignalInput[]) => void;
  syncSignals: (
    signals: DemoSignalInput[],
    prices: Record<string, number>,
    marketOpen?: boolean,
  ) => void;
  closePosition: (id: string, marketPrice: number, reason: string) => void;
  resetAccount: () => void;
  prepareMorningCandidates: (signals: DemoSignalInput[]) => void;
}

const INITIAL_BALANCE = 100_000;
const MAX_ALLOCATION_RATIO = 0.2;
const COMMISSION_RATE = 0.001;
const SLIPPAGE_RATE = 0.002;
const STORAGE_KEY = "bist_demo_account_v1";

const createInitialAccount = (): DemoAccount => ({
  initialBalance: INITIAL_BALANCE,
  cash: INITIAL_BALANCE,
  positions: [],
  closedTrades: [],
  signalSnapshots: [],
  morningCandidates: [],
  processedSignalKeys: [],
});

const getDayKey = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const saveAccount = (account: DemoAccount): void => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account));
};

const usableSignal = (signal: DemoSignalInput): boolean =>
  Number.isFinite(signal.price) &&
  signal.price > 0 &&
  (signal.signalType === "gunluk_teyitli" || signal.score >= 50);

const closeInAccount = (
  account: DemoAccount,
  position: DemoPosition,
  marketPrice: number,
  reason: string,
  now: number,
): DemoAccount => {
  const exitPrice = marketPrice * (1 - SLIPPAGE_RATE);
  const grossValue = position.quantity * exitPrice;
  const exitFee = grossValue * COMMISSION_RATE;
  const realizedPnl =
    grossValue -
    exitFee -
    position.quantity * position.entryPrice -
    position.entryFee;
  const closed: DemoPosition = {
    ...position,
    exitPrice,
    exitAt: now,
    exitFee,
    exitSlippage: marketPrice - exitPrice,
    realizedPnl,
    exitReason: reason,
  };
  return {
    ...account,
    cash: account.cash + grossValue - exitFee,
    positions: account.positions.filter((item) => item.id !== position.id),
    closedTrades: [closed, ...account.closedTrades].slice(0, 200),
  };
};

const recordSignalSnapshots = (
  account: DemoAccount,
  signals: DemoSignalInput[],
  now: number,
): DemoAccount => {
  const existingIds = new Set(account.signalSnapshots.map((item) => item.id));
  const newSnapshots = signals
    .filter((signal) => Number.isFinite(signal.price) && signal.price > 0)
    .map((signal) => ({
      id: `${signal.symbol}-${getDayKey(now)}-${signal.signalType}`,
      symbol: signal.symbol,
      signalType: signal.signalType,
      signalScore: signal.score,
      confirmations: signal.confirmations,
      signalPrice: signal.price,
      signalAt: now,
    }))
    .filter((snapshot) => !existingIds.has(snapshot.id));

  if (newSnapshots.length === 0) return account;
  return {
    ...account,
    signalSnapshots: [...account.signalSnapshots, ...newSnapshots].slice(-1000),
  };
};

const applyBuy = (
  account: DemoAccount,
  signal: DemoSignalInput,
  now: number,
): DemoAccount => {
  if (!usableSignal(signal)) return account;
  if (account.positions.some((position) => position.symbol === signal.symbol))
    return account;

  const signalKey = `${signal.symbol}-${getDayKey(now)}-${signal.signalType}`;
  if (account.processedSignalKeys.includes(signalKey)) return account;

  const allocation = Math.min(
    account.cash * MAX_ALLOCATION_RATIO,
    account.cash,
  );
  const entryPrice = signal.price * (1 + SLIPPAGE_RATE);
  const quantity = Math.floor(
    allocation / (entryPrice * (1 + COMMISSION_RATE)),
  );
  if (quantity < 1) return account;

  const grossCost = quantity * entryPrice;
  const entryFee = grossCost * COMMISSION_RATE;
  const totalCost = grossCost + entryFee;

  return {
    ...account,
    cash: account.cash - totalCost,
    positions: [
      ...account.positions,
      {
        id: `${signal.symbol}-${now}`,
        symbol: signal.symbol,
        signalType: signal.signalType,
        signalScore: signal.score,
        confirmations: signal.confirmations,
        quantity,
        entryPrice,
        entryAt: now,
        entryFee,
        entrySlippage: entryPrice - signal.price,
      },
    ],
    processedSignalKeys: [...account.processedSignalKeys, signalKey].slice(
      -500,
    ),
  };
};

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<DemoAccount>(createInitialAccount);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          setAccount({ ...createInitialAccount(), ...JSON.parse(raw) });
        } catch {
          setAccount(createInitialAccount());
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateAccount = useCallback((next: DemoAccount) => {
    setAccount(next);
    saveAccount(next);
  }, []);

  const executeSignals = useCallback(
    (signals: DemoSignalInput[]) => {
      if (signals.length === 0) return;
      const now = Date.now();
      const next = signals.reduce(
        (current, signal) => applyBuy(current, signal, now),
        account,
      );
      if (next !== account) updateAccount(next);
    },
    [account, updateAccount],
  );

  const prepareMorningCandidates = useCallback(
    (signals: DemoSignalInput[]) => {
      const now = Date.now();
      const candidates = signals
        .filter(
          (signal) =>
            Number.isFinite(signal.price) &&
            signal.price > 0 &&
            signal.dailyTrend !== "down" &&
            (signal.signalType === "gunluk_teyitli" || signal.score >= 50),
        )
        .slice(0, 12)
        .map((signal) => ({
          id: `${signal.symbol}-${getDayKey(now)}-${signal.signalType}`,
          symbol: signal.symbol,
          signalType: signal.signalType,
          signalScore: signal.score,
          confirmations: signal.confirmations,
          closePrice: signal.price,
          closeAt: now,
          status: "bekliyor" as const,
          reason:
            signal.signalType === "gunluk_teyitli"
              ? `${signal.confirmations}/6 teyit ve kapanışta aşağı yön yok`
              : `Erken hareket skoru ${signal.score.toFixed(0)} ve yön aşağı değil`,
        }));
      updateAccount({ ...account, morningCandidates: candidates });
    },
    [account, updateAccount],
  );

  const syncSignals = useCallback(
    (
      signals: DemoSignalInput[],
      prices: Record<string, number>,
      marketOpen = true,
    ) => {
      const currentBySymbol = new Map(
        signals.map((signal) => [signal.symbol, signal]),
      );
      const now = Date.now();
      let next = recordSignalSnapshots(account, signals, now);
      for (const position of account.positions) {
        const signal = currentBySymbol.get(position.symbol);
        const price = prices[position.symbol];
        if (!price) continue;
        const shouldClose =
          !signal ||
          signal.dailyTrend === "down" ||
          (position.signalType === "gunluk_teyitli" &&
            signal.confirmations < 5);
        if (shouldClose) {
          next = closeInAccount(
            next,
            position,
            price,
            !signal
              ? "Radar dışı kaldı"
              : signal.dailyTrend === "down"
                ? "Trend aşağı döndü"
                : "Günlük teyit zayıfladı",
            now,
          );
        }
      }
      if (marketOpen) {
        for (const signal of signals) {
          next = applyBuy(next, signal, now);
        }
      }
      if (next !== account) updateAccount(next);
    },
    [account, updateAccount],
  );

  const closePosition = useCallback(
    (id: string, marketPrice: number, reason: string) => {
      if (!Number.isFinite(marketPrice) || marketPrice <= 0) return;
      const position = account.positions.find((item) => item.id === id);
      if (!position) return;
      updateAccount(
        closeInAccount(account, position, marketPrice, reason, Date.now()),
      );
    },
    [account, updateAccount],
  );

  const resetAccount = useCallback(() => {
    updateAccount(createInitialAccount());
  }, [updateAccount]);

  const value = useMemo(
    () => ({
      account,
      loading,
      executeSignals,
      syncSignals,
      prepareMorningCandidates,
      closePosition,
      resetAccount,
    }),
    [
      account,
      loading,
      executeSignals,
      syncSignals,
      prepareMorningCandidates,
      closePosition,
      resetAccount,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

const DemoContext = createContext<DemoContextType>({
  account: createInitialAccount(),
  loading: false,
  executeSignals: () => {},
  syncSignals: () => {},
  prepareMorningCandidates: () => {},
  closePosition: () => {},
  resetAccount: () => {},
});

export function useDemo() {
  return useContext(DemoContext);
}
