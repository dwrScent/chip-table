import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { nowIso, normalizeName } from "@/lib/utils";
import { parseAmount, parsePlayerName, parsePositiveId } from "@/lib/validation";
import type { ActionLogRow, PlayerRow, PublicActionLog, TableRow, TableStateRow } from "@/lib/types/models";

interface StatePayload {
  table: {
    id: number;
    name: string;
  };
  pot: {
    amount: number;
    updatedAt: string;
  };
  players: Array<{
    id: number;
    name: string;
    walletChips: number;
    isSeated: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  logs: PublicActionLog[];
}

const PLAYER_COLUMNS =
  "id, table_id, name, normalized_name, wallet_chips, is_seated, created_at, updated_at";

function toPublicLog(row: ActionLogRow): PublicActionLog {
  let meta: Record<string, unknown> | null = null;

  if (row.meta_json) {
    try {
      const parsed = JSON.parse(row.meta_json) as unknown;
      meta = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      meta = null;
    }
  }

  return {
    id: row.id,
    actionType: row.action_type,
    message: row.message,
    meta,
    createdAt: row.created_at
  };
}

export class ChipTableService {
  private readonly db: Database.Database;

  constructor(db = getDb()) {
    this.db = db;
  }

  private getTable() {
    const table = this.db.prepare<[], TableRow>("SELECT id, name, created_at, updated_at FROM tables ORDER BY id ASC LIMIT 1").get();
    if (!table) {
      throw new AppError(500, "TABLE_NOT_FOUND", "牌桌未初始化");
    }

    return table;
  }

  private getState() {
    const state = this.db
      .prepare<[], TableStateRow>("SELECT id, table_id, pot_amount, updated_at FROM table_state WHERE id = 1")
      .get();

    if (!state) {
      throw new AppError(500, "STATE_NOT_FOUND", "牌桌状态未初始化");
    }

    return state;
  }

  private getPlayerById(playerId: number) {
    const player = this.db
      .prepare<[number], PlayerRow>(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`)
      .get(playerId);

    if (!player) {
      throw new AppError(404, "PLAYER_NOT_FOUND", "玩家不存在");
    }

    return player;
  }

  private ensureSeated(player: PlayerRow) {
    if (player.is_seated !== 1) {
      throw new AppError(400, "PLAYER_NOT_SEATED", "该玩家已下桌，无法执行该操作");
    }
  }

  private createLog(tableId: number, actionType: string, message: string, playerId?: number, meta?: object) {
    const now = nowIso();
    const metaJson = meta ? JSON.stringify(meta) : null;

    this.db
      .prepare(
        "INSERT INTO action_logs (table_id, player_id, action_type, message, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(tableId, playerId ?? null, actionType, message, metaJson, now);
  }

  private listPublicLogs(limit = env.logLimit) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    return this.db
      .prepare<[number], ActionLogRow>(
        "SELECT id, table_id, player_id, action_type, message, meta_json, created_at FROM action_logs ORDER BY id DESC LIMIT ?"
      )
      .all(safeLimit)
      .map(toPublicLog);
  }

  getStatePayload(limit = env.logLimit): StatePayload {
    const table = this.getTable();
    const state = this.getState();

    const players = this.db
      .prepare<[], PlayerRow>(`SELECT ${PLAYER_COLUMNS} FROM players ORDER BY is_seated DESC, id ASC`)
      .all()
      .map((player) => ({
        id: player.id,
        name: player.name,
        walletChips: player.wallet_chips,
        isSeated: player.is_seated === 1,
        createdAt: player.created_at,
        updatedAt: player.updated_at
      }));

    return {
      table: {
        id: table.id,
        name: table.name
      },
      pot: {
        amount: state.pot_amount,
        updatedAt: state.updated_at
      },
      players,
      logs: this.listPublicLogs(limit)
    };
  }

  listLogs(limit = env.logLimit) {
    return this.listPublicLogs(limit);
  }

  joinPlayer(input: { name: unknown }) {
    const name = parsePlayerName(input.name);
    const table = this.getTable();
    const now = nowIso();
    const normalized = normalizeName(name);

    const existing = this.db
      .prepare<[number, string], PlayerRow>(`SELECT ${PLAYER_COLUMNS} FROM players WHERE table_id = ? AND normalized_name = ?`)
      .get(table.id, normalized);

    if (existing && existing.is_seated === 1) {
      throw new AppError(409, "PLAYER_NAME_CONFLICT", "同名玩家已上桌");
    }

    const transaction = this.db.transaction(() => {
      if (existing) {
        this.db.prepare("UPDATE players SET is_seated = 1, updated_at = ?, name = ? WHERE id = ?").run(now, name, existing.id);

        this.createLog(table.id, "PLAYER_JOIN", `玩家 ${name} 重新上桌`, existing.id, {
          playerId: existing.id,
          name
        });

        return this.getPlayerById(existing.id);
      }

      const result = this.db
        .prepare(
          "INSERT INTO players (table_id, name, normalized_name, wallet_chips, is_seated, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)"
        )
        .run(table.id, name, normalized, now, now);

      const playerId = Number(result.lastInsertRowid);
      this.createLog(table.id, "PLAYER_JOIN", `玩家 ${name} 上桌`, playerId, {
        playerId,
        name
      });

      return this.getPlayerById(playerId);
    });

    const player = transaction();

    return {
      player: {
        id: player.id,
        name: player.name,
        walletChips: player.wallet_chips,
        isSeated: player.is_seated === 1
      }
    };
  }

  leavePlayer(input: { playerId: unknown }) {
    const playerId = parsePositiveId(input.playerId, "玩家ID");
    const player = this.getPlayerById(playerId);
    this.ensureSeated(player);

    const table = this.getTable();
    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE players SET is_seated = 0, updated_at = ? WHERE id = ?").run(now, playerId);

      this.createLog(table.id, "PLAYER_LEAVE", `玩家 ${player.name} 下桌`, playerId, {
        playerId,
        name: player.name
      });
    });

    transaction();

    return {
      playerId,
      isSeated: false
    };
  }

  topupPlayer(input: { playerId: unknown; amount: unknown }) {
    const playerId = parsePositiveId(input.playerId, "玩家ID");
    const amount = parseAmount(input.amount);
    const player = this.getPlayerById(playerId);
    this.ensureSeated(player);

    const table = this.getTable();
    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE players SET wallet_chips = wallet_chips + ?, updated_at = ? WHERE id = ?").run(amount, now, playerId);

      this.createLog(table.id, "PLAYER_TOPUP", `给玩家 ${player.name} 增加 ${amount} 筹码`, playerId, {
        playerId,
        name: player.name,
        amount
      });

      return this.getPlayerById(playerId);
    });

    const updated = transaction();

    return {
      player: {
        id: updated.id,
        name: updated.name,
        walletChips: updated.wallet_chips,
        isSeated: updated.is_seated === 1
      }
    };
  }

  betToPot(input: { playerId: unknown; amount: unknown }) {
    const playerId = parsePositiveId(input.playerId, "玩家ID");
    const amount = parseAmount(input.amount);
    const player = this.getPlayerById(playerId);
    this.ensureSeated(player);

    if (player.wallet_chips < amount) {
      throw new AppError(400, "INSUFFICIENT_CHIPS", "下注金额不能超过玩家钱包余额");
    }

    const table = this.getTable();
    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE players SET wallet_chips = wallet_chips - ?, updated_at = ? WHERE id = ?").run(amount, now, playerId);
      this.db.prepare("UPDATE table_state SET pot_amount = pot_amount + ?, updated_at = ? WHERE id = 1").run(amount, now);

      this.createLog(table.id, "PLAYER_BET", `玩家 ${player.name} 向公桌池下注 ${amount} 筹码`, playerId, {
        playerId,
        name: player.name,
        amount
      });

      return {
        player: this.getPlayerById(playerId),
        state: this.getState()
      };
    });

    const result = transaction();

    return {
      player: {
        id: result.player.id,
        name: result.player.name,
        walletChips: result.player.wallet_chips,
        isSeated: result.player.is_seated === 1
      },
      potAmount: result.state.pot_amount
    };
  }

  collectPot(input: { winnerPlayerId: unknown }) {
    const winnerPlayerId = parsePositiveId(input.winnerPlayerId, "赢家玩家ID");
    const winner = this.getPlayerById(winnerPlayerId);
    this.ensureSeated(winner);

    const table = this.getTable();
    const state = this.getState();

    if (state.pot_amount <= 0) {
      throw new AppError(400, "EMPTY_POT", "公桌池为空，无法收池");
    }

    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE players SET wallet_chips = wallet_chips + ?, updated_at = ? WHERE id = ?").run(
        state.pot_amount,
        now,
        winnerPlayerId
      );

      this.db.prepare("UPDATE table_state SET pot_amount = 0, updated_at = ? WHERE id = 1").run(now);

      this.createLog(
        table.id,
        "POT_COLLECT",
        `玩家 ${winner.name} 收走公桌池 ${state.pot_amount} 筹码`,
        winnerPlayerId,
        {
          winnerPlayerId,
          name: winner.name,
          amount: state.pot_amount
        }
      );

      return {
        winner: this.getPlayerById(winnerPlayerId)
      };
    });

    const result = transaction();

    return {
      winner: {
        id: result.winner.id,
        name: result.winner.name,
        walletChips: result.winner.wallet_chips,
        isSeated: result.winner.is_seated === 1
      },
      collectedAmount: state.pot_amount,
      potAmount: 0
    };
  }

  clearPot(input: { adminPin: unknown }) {
    const adminPin = typeof input.adminPin === "string" ? input.adminPin.trim() : "";

    if (!adminPin || adminPin !== env.adminPin) {
      throw new AppError(403, "ADMIN_PIN_INVALID", "管理员 PIN 不正确");
    }

    const table = this.getTable();
    const state = this.getState();
    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE table_state SET pot_amount = 0, updated_at = ? WHERE id = 1").run(now);
      this.createLog(table.id, "POT_CLEAR", `管理员清零公桌池（原值 ${state.pot_amount}）`, undefined, {
        previousPot: state.pot_amount
      });
    });

    transaction();

    return {
      previousPot: state.pot_amount,
      potAmount: 0
    };
  }

  resetTable(input: { adminPin: unknown }) {
    const adminPin = typeof input.adminPin === "string" ? input.adminPin.trim() : "";

    if (!adminPin || adminPin !== env.adminPin) {
      throw new AppError(403, "ADMIN_PIN_INVALID", "管理员 PIN 不正确");
    }

    const table = this.getTable();
    const now = nowIso();

    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE players SET wallet_chips = 0, updated_at = ?").run(now);
      this.db.prepare("UPDATE table_state SET pot_amount = 0, updated_at = ? WHERE id = 1").run(now);

      this.createLog(table.id, "TABLE_RESET", "管理员执行整桌清零", undefined, {
        action: "table_reset"
      });
    });

    transaction();

    return {
      reset: true
    };
  }

  updateTable(input: { name: unknown }) {
    const name = parsePlayerName(input.name);
    const table = this.getTable();

    const now = nowIso();
    this.db.prepare("UPDATE tables SET name = ?, updated_at = ? WHERE id = ?").run(name, now, table.id);

    this.createLog(table.id, "TABLE_RENAME", `牌桌名称更新为 ${name}`, undefined, {
      tableName: name
    });

    return {
      id: table.id,
      name
    };
  }
}

export const chipTableService = new ChipTableService();
