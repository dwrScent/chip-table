"use client";

import { BanknoteArrowDown, CircleOff, Coins, Crown, HandCoins } from "lucide-react";

export interface PlayerView {
  id: number;
  name: string;
  walletChips: number;
  isSeated: boolean;
}

interface PlayerCardProps {
  player: PlayerView;
  disabled: boolean;
  labels: {
    joined: string;
    left: string;
    walletChips: string;
    topup: string;
    bet: string;
    collect: string;
    leave: string;
  };
  onTopup: (player: PlayerView) => void;
  onBet: (player: PlayerView) => void;
  onCollect: (player: PlayerView) => void;
  onLeave: (player: PlayerView) => void;
}

export function PlayerCard({ player, disabled, labels, onTopup, onBet, onCollect, onLeave }: PlayerCardProps) {
  return (
    <article className="player-card">
      <div className="player-top">
        <strong>{player.name}</strong>
        <span className={`badge ${player.isSeated ? "seated" : "left"}`}>{player.isSeated ? labels.joined : labels.left}</span>
      </div>

      <div className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
        <Coins size={15} />
        {labels.walletChips}<strong>{player.walletChips}</strong>
      </div>

      <div className="actions">
        <button onClick={() => onTopup(player)} disabled={disabled || !player.isSeated}>
          <BanknoteArrowDown size={14} />
          {labels.topup}
        </button>

        <button onClick={() => onBet(player)} disabled={disabled || !player.isSeated || player.walletChips <= 0}>
          <HandCoins size={14} />
          {labels.bet}
        </button>

        <button className="warning" onClick={() => onCollect(player)} disabled={disabled || !player.isSeated}>
          <Crown size={14} />
          {labels.collect}
        </button>

        <button className="danger" onClick={() => onLeave(player)} disabled={disabled || !player.isSeated}>
          <CircleOff size={14} />
          {labels.leave}
        </button>
      </div>
    </article>
  );
}
