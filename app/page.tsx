"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CirclePlus,
  Coins,
  Globe2,
  LoaderCircle,
  RefreshCcw,
  ScrollText,
  Settings,
  Shield,
  Table,
  Users
} from "lucide-react";
import { ConfirmModal } from "@/app/components/confirm-modal";
import { PlayerCard, type PlayerView } from "@/app/components/player-card";
import { PromptModal } from "@/app/components/prompt-modal";
import { translations, type Language } from "@/app/i18n";
import { apiRequest, ApiClientError } from "@/lib/client-api";

interface LogView {
  id: number;
  actionType: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface StatePayload {
  table: { id: number; name: string };
  pot: { amount: number; updatedAt: string };
  players: PlayerView[];
  logs: LogView[];
}

type PromptState =
  | { type: "join" }
  | { type: "topup"; player: PlayerView }
  | { type: "bet"; player: PlayerView }
  | null;

type ConfirmState =
  | { type: "collect"; player: PlayerView }
  | { type: "leave"; player: PlayerView }
  | { type: "clearPot" }
  | { type: "resetTable" }
  | null;

const languageStorageKey = "chip-table-language";
const autoRefreshIntervalMs = 3000;

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en";
}

function formatTime(value: string, language: Language) {
  const date = new Date(value);
  return date.toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
    hour12: false
  });
}

function getString(meta: Record<string, unknown> | null, key: string) {
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

function getNumber(meta: Record<string, unknown> | null, key: string) {
  const value = meta?.[key];
  return typeof value === "number" ? value : undefined;
}

function localizeLegacyLog(message: string) {
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^玩家 (.+) 重新上桌$/, (match) => `${match[1]} rejoined the table`],
    [/^玩家 (.+) 上桌$/, (match) => `${match[1]} joined the table`],
    [/^玩家 (.+) 下桌$/, (match) => `${match[1]} left the table`],
    [/^给玩家 (.+) 增加 (\d+) 筹码$/, (match) => `Added ${match[2]} chips to ${match[1]}`],
    [/^玩家 (.+) 向公桌池下注 (\d+) 筹码$/, (match) => `${match[1]} bet ${match[2]} chips to the pot`],
    [/^玩家 (.+) 收走公桌池 (\d+) 筹码$/, (match) => `${match[1]} collected ${match[2]} chips from the pot`],
    [/^管理员清零公桌池（原值 (\d+)）$/, (match) => `Admin cleared the pot; previous value was ${match[1]}`],
    [/^管理员执行整桌清零$/, () => "Admin reset the table"],
    [/^牌桌名称更新为 (.+)$/, (match) => `Table name changed to ${match[1]}`]
  ];

  for (const [pattern, format] of patterns) {
    const match = message.match(pattern);
    if (match) {
      return format(match);
    }
  }

  return message;
}

function localizeLog(log: LogView, language: Language) {
  if (language === "zh") {
    return log.message;
  }

  const name = getString(log.meta, "name");
  const amount = getNumber(log.meta, "amount");
  const previousPot = getNumber(log.meta, "previousPot");
  const tableName = getString(log.meta, "tableName");

  switch (log.actionType) {
    case "PLAYER_JOIN":
      return name ? `${name} joined the table` : localizeLegacyLog(log.message);
    case "PLAYER_LEAVE":
      return name ? `${name} left the table` : localizeLegacyLog(log.message);
    case "PLAYER_TOPUP":
      return name && amount !== undefined ? `Added ${amount} chips to ${name}` : localizeLegacyLog(log.message);
    case "PLAYER_BET":
      return name && amount !== undefined ? `${name} bet ${amount} chips to the pot` : localizeLegacyLog(log.message);
    case "POT_COLLECT":
      return name && amount !== undefined ? `${name} collected ${amount} chips from the pot` : localizeLegacyLog(log.message);
    case "POT_CLEAR":
      return previousPot !== undefined ? `Admin cleared the pot; previous value was ${previousPot}` : localizeLegacyLog(log.message);
    case "TABLE_RESET":
      return "Admin reset the table";
    case "TABLE_RENAME":
      return tableName ? `Table name changed to ${tableName}` : localizeLegacyLog(log.message);
    default:
      return localizeLegacyLog(log.message);
  }
}

export default function HomePage() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") {
      return "zh";
    }

    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    return isLanguage(storedLanguage) ? storedLanguage : "zh";
  });
  const [state, setState] = useState<StatePayload | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const autoRefreshInFlight = useRef(false);

  const isBusy = actionKey !== null;
  const t = translations[language];

  const seatedPlayers = useMemo(() => {
    return state?.players.filter((player) => player.isSeated) ?? [];
  }, [state?.players]);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
  }, []);

  const getErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiClientError) {
        return t.errors[error.code as keyof typeof t.errors] ?? error.message;
      }

      return fallback;
    },
    [t]
  );

  const fetchState = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingPage(true);
    }

    try {
      const data = await apiRequest<StatePayload>("/api/state?logLimit=80");
      setState(data);
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : translations.zh.fetchFailed;
      setNotice({ type: "error", text: message });
    } finally {
      if (!silent) {
        setLoadingPage(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden" || isBusy || prompt || confirm || autoRefreshInFlight.current) {
        return;
      }

      autoRefreshInFlight.current = true;
      void fetchState(true).finally(() => {
        autoRefreshInFlight.current = false;
      });
    }, autoRefreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [confirm, fetchState, isBusy, prompt]);

  const runAction = useCallback(
    async (key: string, callback: () => Promise<void>, successText: string) => {
      if (isBusy) {
        return;
      }

      setActionKey(key);
      setNotice(null);

      try {
        await callback();
        await fetchState(true);
        setNotice({ type: "success", text: successText });
      } catch (error) {
        const message = getErrorMessage(error, t.actionFailed);
        setNotice({ type: "error", text: message });
      } finally {
        setActionKey(null);
      }
    },
    [fetchState, getErrorMessage, isBusy, t.actionFailed]
  );

  const onPromptSubmit = async (value: string) => {
    if (!prompt) {
      return;
    }

    if (prompt.type === "join") {
      await runAction(
        "join",
        async () => {
          await apiRequest("/api/players/join", {
            method: "POST",
            body: JSON.stringify({ name: value })
          });
        },
        t.playerJoined
      );
      setPrompt(null);
      return;
    }

    if (prompt.type === "topup") {
      await runAction(
        `topup:${prompt.player.id}`,
        async () => {
          await apiRequest(`/api/players/${prompt.player.id}/topup`, {
            method: "POST",
            body: JSON.stringify({ amount: value })
          });
        },
        t.topupDone(prompt.player.name)
      );
      setPrompt(null);
      return;
    }

    if (prompt.type === "bet") {
      await runAction(
        `bet:${prompt.player.id}`,
        async () => {
          await apiRequest(`/api/players/${prompt.player.id}/bet`, {
            method: "POST",
            body: JSON.stringify({ amount: value })
          });
        },
        t.betDone(prompt.player.name)
      );
      setPrompt(null);
    }
  };

  const onConfirm = async () => {
    if (!confirm) {
      return;
    }

    if (confirm.type === "collect") {
      await runAction(
        `collect:${confirm.player.id}`,
        async () => {
          await apiRequest("/api/pot/collect", {
            method: "POST",
            body: JSON.stringify({ winnerPlayerId: confirm.player.id })
          });
        },
        t.collectDone(confirm.player.name)
      );
      setConfirm(null);
      return;
    }

    if (confirm.type === "leave") {
      await runAction(
        `leave:${confirm.player.id}`,
        async () => {
          await apiRequest(`/api/players/${confirm.player.id}/leave`, {
            method: "POST",
            body: JSON.stringify({})
          });
        },
        t.leaveDone(confirm.player.name)
      );
      setConfirm(null);
      return;
    }

    if (confirm.type === "clearPot") {
      await runAction(
        "clear-pot",
        async () => {
          await apiRequest("/api/pot/clear", {
            method: "POST",
            body: JSON.stringify({ adminPin })
          });
        },
        t.clearPotDone
      );
      setConfirm(null);
      return;
    }

    if (confirm.type === "resetTable") {
      await runAction(
        "reset-table",
        async () => {
          await apiRequest("/api/table/reset", {
            method: "POST",
            body: JSON.stringify({ adminPin })
          });
        },
        t.resetTableDone
      );
      setConfirm(null);
    }
  };

  if (loadingPage && !state) {
    return (
      <main>
        <section className="card players-section" style={{ display: "grid", placeItems: "center", minHeight: "55vh" }}>
          <LoaderCircle className="spin" />
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="card header">
        <div className="title-wrap header-left">
          <h1 className="title">{t.appName}</h1>
          <span className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Table size={15} />
            {t.currentTable}: {state?.table.name ?? "-"}
          </span>
        </div>

        <div className="header-center">
          <span className="pot-chip">
            <Coins size={24} />
            {t.sharedPot} {state?.pot.amount ?? 0}
          </span>
        </div>

        <div className="header-actions">
          <button className="primary" onClick={() => setPrompt({ type: "join" })} disabled={isBusy}>
            <CirclePlus size={14} />
            {t.join}
          </button>
          <button
            className={adminPanelOpen ? "primary" : ""}
            onClick={() => setAdminPanelOpen((open) => !open)}
            disabled={isBusy}
          >
            <Shield size={14} />
            {t.admin}
          </button>
          <button onClick={() => void fetchState(true)} disabled={isBusy}>
            <RefreshCcw size={14} />
            {t.refresh}
          </button>
          <div className="language-switch" aria-label="Language selector">
            <Globe2 size={14} />
            <button
              className={language === "zh" ? "active" : ""}
              type="button"
              onClick={() => changeLanguage("zh")}
              disabled={isBusy}
            >
              中文
            </button>
            <button
              className={language === "en" ? "active" : ""}
              type="button"
              onClick={() => changeLanguage("en")}
              disabled={isBusy}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}

      <section className="grid">
        <div className="card players-section">
          <div className="section-head">
            <h2 className="section-title">
              <Users size={16} />
              {t.players}
            </h2>
            <span className="subtle">{t.seatedCount(seatedPlayers.length)}</span>
          </div>

          {seatedPlayers.length > 0 ? (
            <div className="players-grid">
              {seatedPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  disabled={isBusy}
                  labels={{
                    joined: t.joined,
                    left: t.left,
                    walletChips: t.walletChips,
                    topup: t.topup,
                    bet: t.bet,
                    collect: t.collect,
                    leave: t.leave
                  }}
                  onTopup={(target) => setPrompt({ type: "topup", player: target })}
                  onBet={(target) => setPrompt({ type: "bet", player: target })}
                  onCollect={(target) => setConfirm({ type: "collect", player: target })}
                  onLeave={(target) => setConfirm({ type: "leave", player: target })}
                />
              ))}
            </div>
          ) : (
            <div className="empty">{t.emptyPlayers}</div>
          )}
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {adminPanelOpen ? (
            <aside className="card admin-section">
              <div className="section-head">
                <h2 className="section-title">
                  <Shield size={16} />
                  {t.adminActions}
                </h2>
                <Settings size={16} />
              </div>

              <div className="admin-controls">
                <label className="inline-field">
                  <span className="subtle">{t.adminPin}</span>
                  <input
                    type="password"
                    placeholder={t.adminPinPlaceholder}
                    value={adminPin}
                    onChange={(event) => setAdminPin(event.target.value)}
                  />
                </label>

                <button className="warning" disabled={isBusy} onClick={() => setConfirm({ type: "clearPot" })}>
                  {t.clearPot}
                </button>

                <button className="danger" disabled={isBusy} onClick={() => setConfirm({ type: "resetTable" })}>
                  {t.resetTable}
                </button>
              </div>
            </aside>
          ) : null}

          <aside className="card logs-section">
            <div className="section-head">
              <h2 className="section-title">
                <ScrollText size={16} />
                {t.recentActions}
              </h2>
              <Activity size={16} />
            </div>

            {state && state.logs.length > 0 ? (
              <div className="logs-list">
                {state.logs.map((log) => (
                  <article className="log-item" key={log.id}>
                    <div>{localizeLog(log, language)}</div>
                    <div className="log-time">{formatTime(log.createdAt, language)}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">{t.emptyLogs}</div>
            )}
          </aside>
        </div>
      </section>

      <PromptModal
        open={prompt?.type === "join"}
        title={t.joinTitle}
        label={t.playerName}
        inputType="text"
        placeholder={t.playerNamePlaceholder}
        submitLabel={t.confirmJoin}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        loading={actionKey === "join"}
        onClose={() => setPrompt(null)}
        onSubmit={onPromptSubmit}
      />

      <PromptModal
        open={prompt?.type === "topup"}
        title={prompt?.type === "topup" ? t.topupTitle(prompt.player.name) : t.topupFallbackTitle}
        label={t.topupAmount}
        inputType="number"
        placeholder={t.positiveIntegerPlaceholder}
        submitLabel={t.confirmTopup}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        loading={typeof actionKey === "string" && actionKey.startsWith("topup:")}
        onClose={() => setPrompt(null)}
        onSubmit={onPromptSubmit}
      />

      <PromptModal
        open={prompt?.type === "bet"}
        title={prompt?.type === "bet" ? t.betTitle(prompt.player.name) : t.betFallbackTitle}
        label={t.betAmount}
        inputType="number"
        placeholder={t.positiveIntegerPlaceholder}
        submitLabel={t.confirmBet}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        loading={typeof actionKey === "string" && actionKey.startsWith("bet:")}
        onClose={() => setPrompt(null)}
        onSubmit={onPromptSubmit}
      />

      <ConfirmModal
        open={confirm?.type === "collect"}
        title={t.confirmCollectTitle}
        description={
          confirm?.type === "collect"
            ? t.confirmCollectDescription(confirm.player.name)
            : ""
        }
        confirmLabel={t.confirmCollect}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        loading={typeof actionKey === "string" && actionKey.startsWith("collect:")}
        onClose={() => setConfirm(null)}
        onConfirm={onConfirm}
      />

      <ConfirmModal
        open={confirm?.type === "leave"}
        title={t.confirmLeaveTitle}
        description={confirm?.type === "leave" ? t.confirmLeaveDescription(confirm.player.name) : ""}
        confirmLabel={t.confirmLeave}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        danger
        loading={typeof actionKey === "string" && actionKey.startsWith("leave:")}
        onClose={() => setConfirm(null)}
        onConfirm={onConfirm}
      />

      <ConfirmModal
        open={confirm?.type === "clearPot"}
        title={t.confirmClearPotTitle}
        description={t.confirmClearPotDescription}
        confirmLabel={t.confirmClear}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        danger
        loading={actionKey === "clear-pot"}
        onClose={() => setConfirm(null)}
        onConfirm={onConfirm}
      />

      <ConfirmModal
        open={confirm?.type === "resetTable"}
        title={t.confirmResetTitle}
        description={t.confirmResetDescription}
        confirmLabel={t.confirmReset}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        danger
        loading={actionKey === "reset-table"}
        onClose={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
    </main>
  );
}
