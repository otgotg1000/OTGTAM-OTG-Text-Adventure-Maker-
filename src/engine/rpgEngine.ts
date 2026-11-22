import type { TranslationBundle } from '../i18n/translations';
import {
  BodyBlock,
  CombatConfig,
  CombatState,
  ConditionRule,
  DiceRollResult,
  DiceType,
  EffectAction,
  InlineImageSize,
  Passage,
  PlaySession,
  RpgConfig,
  SessionSnapshot,
  SkillCheckConfig,
  StoryProject,
} from '../types/story';

export type RuntimeMessages = TranslationBundle['runtime'];

const DEFAULT_RUNTIME: RuntimeMessages = {
  undidChoice: 'Undid last choice.',
  savedGame: 'Saved game progress to JSON file.',
  loadedGame: 'Loaded saved game.',
  restarted: 'Story restarted.',
  invalidSave: 'Could not load save file: incompatible or invalid JSON.',
  passed: 'Passed',
  failed: 'Failed',
  rolled: 'Rolled',
  blocksPath: 'blocks your path',
  youStrike: 'You strike',
  damage: 'damage',
  isDefeated: 'is defeated!',
  looted: 'Looted',
  raiseGuard: 'You raise your guard, bracing for the incoming blow.',
  attacksFor: 'attacks for',
  guarded: '(guarded)',
  youCollapse: 'You collapse as your health reaches zero.',
  disengage: 'You disengage and slip away from the encounter.',
  received: 'Received',
  removed: 'Removed',
  used: 'Used',
  setTo: 'set to',
  questLabel: 'Quest',
  standing: 'standing',
  flagLabel: 'Flag',
  attackLabel: 'Attack',
  defenseLabel: 'Defense',
  gearBonus: 'Your Gear Bonus',
  trueLabel: 'True',
  falseLabel: 'False',
};

function createSessionSnapshot(session: PlaySession): SessionSnapshot {
  return {
    currentPassageId: session.currentPassageId,
    history: [...session.history],
    stats: { ...session.stats },
    inventory: { ...session.inventory },
    quests: { ...session.quests },
    factions: { ...session.factions },
    flags: { ...(session.flags || {}) },
    visitedPassageIds: [...(session.visitedPassageIds || session.history)],
    notifications: [...session.notifications],
    lastRoll: session.lastRoll
      ? { ...session.lastRoll, rawRolls: [...session.lastRoll.rawRolls] }
      : null,
    combat: session.combat
      ? { ...session.combat, log: [...session.combat.log] }
      : null,
  };
}

export function createInitialSession(
  project: StoryProject,
  startId?: string,
  runtimeT?: RuntimeMessages
): PlaySession {
  const stats: Record<string, number> = {};
  for (const s of project.rpgConfig.stats) {
    stats[s.id] = s.initial;
  }

  const quests: Record<string, 'hidden' | 'active' | 'completed' | 'failed'> = {};
  for (const q of project.rpgConfig.quests) {
    quests[q.id] = q.initialStatus;
  }

  const factions: Record<string, number> = {};
  for (const f of project.rpgConfig.factions) {
    factions[f.id] = f.initialReputation;
  }

  const flags: Record<string, boolean> = {};
  for (const fl of project.rpgConfig.flags || []) {
    flags[fl.id] = fl.initialValue;
  }

  const entryId = startId && project.passages[startId] ? startId : project.meta.startPassageId;
  const base: PlaySession = {
    currentPassageId: entryId,
    history: [entryId],
    stats,
    inventory: {},
    quests,
    factions,
    flags,
    visitedPassageIds: [entryId],
    notifications: [],
    lastRoll: null,
    combat: null,
    undoStack: [],
  };

  return enterPassage(project, base, entryId, true, runtimeT);
}

export function enterPassage(
  project: StoryProject,
  session: PlaySession,
  passageId: string,
  isInitial = false,
  runtimeT?: RuntimeMessages
): PlaySession {
  const passage = project.passages[passageId];
  if (!passage) return session;

  const nextUndoStack = isInitial
    ? []
    : [...(session.undoStack ?? []), createSessionSnapshot(session)].slice(-60);

  const prevVisited = session.visitedPassageIds ?? session.history;
  const nextVisited = isInitial
    ? [passageId]
    : prevVisited.includes(passageId)
    ? prevVisited
    : [...prevVisited, passageId];

  let next: PlaySession = {
    ...session,
    currentPassageId: passageId,
    history: isInitial ? [passageId] : [...session.history, passageId],
    flags: session.flags ? { ...session.flags } : {},
    visitedPassageIds: nextVisited,
    notifications: [],
    lastRoll: null,
    combat: null,
    undoStack: nextUndoStack,
  };

  if (passage.entryEffects.length > 0) {
    next = applyEffects(project.rpgConfig, next, passage.entryEffects, runtimeT);
  }

  if (passage.combat) {
    next.combat = createCombatState(passage.combat, runtimeT);
  }

  return next;
}

export function undoLastChoice(
  session: PlaySession,
  runtimeT?: RuntimeMessages
): PlaySession {
  const rt = runtimeT || DEFAULT_RUNTIME;
  const stack = session.undoStack ?? [];
  if (stack.length === 0) return session;
  const previous = stack[stack.length - 1];
  return {
    ...previous,
    flags: previous.flags ? { ...previous.flags } : {},
    visitedPassageIds: previous.visitedPassageIds
      ? [...previous.visitedPassageIds]
      : [...previous.history],
    notifications: [rt.undidChoice],
    undoStack: stack.slice(0, -1),
  };
}

export interface SaveGamePayload {
  format: 'otgtam_save_v1';
  projectId: string;
  projectTitle: string;
  savedAt: string;
  session: PlaySession;
}

export function createSaveGamePayload(
  project: StoryProject,
  session: PlaySession
): SaveGamePayload {
  return {
    format: 'otgtam_save_v1',
    projectId: project.id,
    projectTitle: project.meta.title,
    savedAt: new Date().toISOString(),
    session,
  };
}

export function parseSaveGamePayload(
  project: StoryProject,
  rawJson: string,
  runtimeT?: RuntimeMessages
): PlaySession | null {
  const rt = runtimeT || DEFAULT_RUNTIME;
  try {
    const parsed = JSON.parse(rawJson) as Partial<SaveGamePayload> & Partial<PlaySession>;
    const candidate =
      parsed.format === 'otgtam_save_v1' && parsed.session
        ? parsed.session
        : parsed.currentPassageId
        ? (parsed as PlaySession)
        : null;

    if (!candidate || !candidate.currentPassageId || !project.passages[candidate.currentPassageId]) {
      return null;
    }

    const history = Array.isArray(candidate.history)
      ? candidate.history
      : [candidate.currentPassageId];

    return {
      currentPassageId: candidate.currentPassageId,
      history,
      stats: candidate.stats || {},
      inventory: candidate.inventory || {},
      quests: candidate.quests || {},
      factions: candidate.factions || {},
      flags: candidate.flags || {},
      visitedPassageIds: Array.isArray(candidate.visitedPassageIds)
        ? candidate.visitedPassageIds
        : Array.from(new Set(history)),
      notifications: [rt.loadedGame],
      lastRoll: candidate.lastRoll || null,
      combat: candidate.combat || null,
      undoStack: Array.isArray(candidate.undoStack) ? candidate.undoStack : [],
    };
  } catch {
    return null;
  }
}

export function createCombatState(
  cfg: CombatConfig,
  runtimeT?: RuntimeMessages
): CombatState {
  const rt = runtimeT || DEFAULT_RUNTIME;
  return {
    enemyName: cfg.enemyName,
    enemyPortraitId: cfg.enemyPortraitId,
    enemyHp: cfg.enemyMaxHp,
    enemyMaxHp: cfg.enemyMaxHp,
    enemyAttackMin: cfg.enemyAttackMin,
    enemyAttackMax: cfg.enemyAttackMax,
    enemyDefense: cfg.enemyDefense,
    playerHpStatId: cfg.playerHpStatId,
    playerAttackStatId: cfg.playerAttackStatId,
    lootItemId: cfg.lootItemId,
    victoryPassageId: cfg.victoryPassageId,
    defeatPassageId: cfg.defeatPassageId,
    fleePassageId: cfg.fleePassageId,
    defending: false,
    resolved: 'ongoing',
    log: [`${cfg.enemyName} ${rt.blocksPath} (${cfg.enemyMaxHp} HP).`],
  };
}

export function applyEffects(
  config: RpgConfig,
  session: PlaySession,
  effects: EffectAction[],
  runtimeT?: RuntimeMessages
): PlaySession {
  const rt = runtimeT || DEFAULT_RUNTIME;
  const stats = { ...session.stats };
  const inventory = { ...session.inventory };
  const quests = { ...session.quests };
  const factions = { ...session.factions };
  const flags = { ...(session.flags || {}) };
  const notifications = [...session.notifications];

  for (const effect of effects) {
    if (effect.kind === 'stat') {
      const def = config.stats.find((s) => s.id === effect.statId);
      const current = stats[effect.statId] ?? def?.initial ?? 0;
      let updated = effect.operation === 'set' ? effect.value : current + effect.value;
      if (def) {
        updated = Math.max(def.min, Math.min(def.max, updated));
      }
      stats[effect.statId] = updated;
      const label = def?.name ?? effect.statId;
      if (effect.operation === 'add' && effect.value !== 0) {
        notifications.push(`${label} ${effect.value > 0 ? `+${effect.value}` : effect.value}`);
      } else if (effect.operation === 'set') {
        notifications.push(`${label} ${rt.setTo} ${updated}`);
      }
    } else if (effect.kind === 'item') {
      const def = config.items.find((i) => i.id === effect.itemId);
      const qty = Math.max(1, effect.quantity || 1);
      const current = inventory[effect.itemId] ?? 0;
      if (effect.operation === 'give') {
        inventory[effect.itemId] = current + qty;
        notifications.push(`${rt.received} ${qty}x ${def?.name ?? effect.itemId}`);
      } else {
        const nextQty = Math.max(0, current - qty);
        if (nextQty === 0) {
          delete inventory[effect.itemId];
        } else {
          inventory[effect.itemId] = nextQty;
        }
        notifications.push(`${rt.removed} ${qty}x ${def?.name ?? effect.itemId}`);
      }
    } else if (effect.kind === 'quest') {
      const def = config.quests.find((q) => q.id === effect.questId);
      quests[effect.questId] = effect.status;
      notifications.push(`${rt.questLabel} ${effect.status}: ${def?.title ?? effect.questId}`);
    } else if (effect.kind === 'faction') {
      const def = config.factions.find((f) => f.id === effect.factionId);
      const current = factions[effect.factionId] ?? def?.initialReputation ?? 0;
      factions[effect.factionId] = current + effect.delta;
      notifications.push(
        `${def?.name ?? effect.factionId} ${rt.standing} ${effect.delta >= 0 ? `+${effect.delta}` : effect.delta}`
      );
    } else if (effect.kind === 'flag') {
      const def = (config.flags || []).find((f) => f.id === effect.flagId);
      flags[effect.flagId] = effect.value;
      notifications.push(
        `${rt.flagLabel}: ${def?.name ?? effect.flagId} = ${effect.value ? rt.trueLabel : rt.falseLabel}`
      );
    }
  }

  return {
    ...session,
    stats,
    inventory,
    quests,
    factions,
    flags,
    notifications,
  };
}

export function evaluateCondition(session: PlaySession, rule?: ConditionRule): boolean {
  if (!rule) return true;
  switch (rule.kind) {
    case 'stat_gte':
      return (session.stats[rule.statId] ?? 0) >= rule.value;
    case 'stat_lte':
      return (session.stats[rule.statId] ?? 0) <= rule.value;
    case 'has_item':
      return (session.inventory[rule.itemId] ?? 0) > 0;
    case 'quest_status':
      return session.quests[rule.questId] === rule.status;
    case 'faction_gte':
      return (session.factions[rule.factionId] ?? 0) >= rule.value;
    case 'flag_is':
      return Boolean(session.flags?.[rule.flagId]) === rule.value;
    case 'visited_passage': {
      const visited = (session.visitedPassageIds || session.history).includes(rule.passageId);
      return visited === rule.visited;
    }
    default:
      return true;
  }
}

export function formatConditionLabel(
  config: RpgConfig,
  rule?: ConditionRule,
  passages?: Record<string, Passage>,
  runtimeT?: RuntimeMessages
): string {
  if (!rule) return '';
  const rt = runtimeT || DEFAULT_RUNTIME;
  switch (rule.kind) {
    case 'stat_gte': {
      const stat = config.stats.find((s) => s.id === rule.statId);
      return `${stat?.name ?? rule.statId} ≥ ${rule.value}`;
    }
    case 'stat_lte': {
      const stat = config.stats.find((s) => s.id === rule.statId);
      return `${stat?.name ?? rule.statId} ≤ ${rule.value}`;
    }
    case 'has_item': {
      const item = config.items.find((i) => i.id === rule.itemId);
      return `Item: ${item?.name ?? rule.itemId}`;
    }
    case 'quest_status': {
      const quest = config.quests.find((q) => q.id === rule.questId);
      return `${rt.questLabel} "${quest?.title ?? rule.questId}": ${rule.status}`;
    }
    case 'faction_gte': {
      const faction = config.factions.find((f) => f.id === rule.factionId);
      return `${faction?.name ?? rule.factionId} ≥ ${rule.value}`;
    }
    case 'flag_is': {
      const flag = (config.flags || []).find((f) => f.id === rule.flagId);
      return `${flag?.name ?? rule.flagId} = ${rule.value ? rt.trueLabel : rt.falseLabel}`;
    }
    case 'visited_passage': {
      const targetTitle = passages?.[rule.passageId]?.title ?? rule.passageId;
      return `${rule.visited ? '✓' : '✕'} ${targetTitle}`;
    }
  }
}

export function formatEffectLabel(config: RpgConfig, effect: EffectAction): string {
  if (effect.kind === 'stat') {
    const stat = config.stats.find((s) => s.id === effect.statId);
    const name = stat?.name ?? effect.statId;
    return effect.operation === 'set'
      ? `${name} = ${effect.value}`
      : `${name} ${effect.value >= 0 ? `+${effect.value}` : effect.value}`;
  }
  if (effect.kind === 'item') {
    const item = config.items.find((i) => i.id === effect.itemId);
    const name = item?.name ?? effect.itemId;
    return effect.operation === 'give' ? `+${effect.quantity} ${name}` : `-${effect.quantity} ${name}`;
  }
  if (effect.kind === 'quest') {
    const quest = config.quests.find((q) => q.id === effect.questId);
    return `Quest "${quest?.title ?? effect.questId}" → ${effect.status}`;
  }
  if (effect.kind === 'flag') {
    const flag = (config.flags || []).find((f) => f.id === effect.flagId);
    return `${flag?.name ?? effect.flagId} = ${effect.value ? 'True' : 'False'}`;
  }
  const faction = config.factions.find((f) => f.id === effect.factionId);
  return `${faction?.name ?? effect.factionId} ${effect.delta >= 0 ? `+${effect.delta}` : effect.delta}`;
}

export function rollDice(dice: DiceType): number[] {
  if (dice === '2d6') {
    return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  }
  if (dice === 'd100') {
    return [1 + Math.floor(Math.random() * 100)];
  }
  return [1 + Math.floor(Math.random() * 20)];
}

export function executeSkillCheck(
  project: StoryProject,
  session: PlaySession,
  check: SkillCheckConfig,
  runtimeT?: RuntimeMessages
): { session: PlaySession; roll: DiceRollResult } {
  const statDef = project.rpgConfig.stats.find((s) => s.id === check.statId);
  const modifier = session.stats[check.statId] ?? 0;
  const rawRolls = rollDice(check.dice);
  const rawSum = rawRolls.reduce((acc, n) => acc + n, 0);
  const total = rawSum + modifier;
  const passed = total >= check.difficulty;

  const roll: DiceRollResult = {
    checkLabel: check.label,
    statName: statDef?.name ?? check.statId,
    dice: check.dice,
    rawRolls,
    modifier,
    total,
    difficulty: check.difficulty,
    passed,
    nextPassageId: passed ? check.successPassageId : check.failurePassageId,
  };

  let next: PlaySession = { ...session, lastRoll: roll };
  const branchEffects = passed ? check.successEffects : check.failureEffects;
  if (branchEffects.length > 0) {
    next = applyEffects(project.rpgConfig, next, branchEffects, runtimeT);
  }

  return { session: next, roll };
}

export function getEquipmentAttackBonus(config: RpgConfig, session: PlaySession): number {
  let bonus = 0;
  for (const item of config.items) {
    if (item.category === 'equipment' && (session.inventory[item.id] ?? 0) > 0 && item.effectAmount) {
      bonus += item.effectAmount;
    }
  }
  return bonus;
}

export function performCombatAction(
  project: StoryProject,
  session: PlaySession,
  action: 'attack' | 'defend' | 'flee' | { kind: 'use_item'; itemId: string },
  runtimeT?: RuntimeMessages
): { session: PlaySession; event: 'hit' | 'heal' | 'victory' | 'defeat' | 'fled' | 'defend' } {
  const rt = runtimeT || DEFAULT_RUNTIME;
  if (!session.combat || session.combat.resolved !== 'ongoing') {
    return { session, event: 'defend' };
  }

  const c = { ...session.combat, log: [...session.combat.log], defending: false };
  const stats = { ...session.stats };
  const inventory = { ...session.inventory };
  const hpDef = project.rpgConfig.stats.find((s) => s.id === c.playerHpStatId);
  const maxHp = hpDef?.max ?? 100;
  let playerHp = stats[c.playerHpStatId] ?? hpDef?.initial ?? 20;

  if (action === 'flee') {
    c.resolved = 'fled';
    c.log.push(rt.disengage);
    return {
      session: { ...session, combat: c },
      event: 'fled',
    };
  }

  let event: 'hit' | 'heal' | 'victory' | 'defeat' | 'fled' | 'defend' = 'hit';

  if (action === 'attack') {
    const atkStat = stats[c.playerAttackStatId] ?? 4;
    const gearBonus = getEquipmentAttackBonus(project.rpgConfig, session);
    const variance = Math.floor(Math.random() * 4) + 1;
    const rawDamage = atkStat + gearBonus + variance;
    const damage = Math.max(1, rawDamage - c.enemyDefense);
    c.enemyHp = Math.max(0, c.enemyHp - damage);
    c.log.push(`${rt.youStrike} ${c.enemyName} (${damage} ${rt.damage}).`);

    if (c.enemyHp <= 0) {
      c.resolved = 'victory';
      c.log.push(`${c.enemyName} ${rt.isDefeated}`);
      const updatedSession: PlaySession = { ...session, stats, inventory, combat: c };
      if (c.lootItemId) {
        const lootItem = project.rpgConfig.items.find((i) => i.id === c.lootItemId);
        updatedSession.inventory = {
          ...updatedSession.inventory,
          [c.lootItemId]: (updatedSession.inventory[c.lootItemId] ?? 0) + 1,
        };
        updatedSession.notifications = [
          ...updatedSession.notifications,
          `${rt.looted} ${lootItem?.name ?? c.lootItemId}`,
        ];
      }
      return { session: updatedSession, event: 'victory' };
    }
  } else if (action === 'defend') {
    c.defending = true;
    c.log.push(rt.raiseGuard);
    event = 'defend';
  } else if (typeof action === 'object' && action.kind === 'use_item') {
    const item = project.rpgConfig.items.find((i) => i.id === action.itemId);
    const count = inventory[action.itemId] ?? 0;
    if (item && count > 0) {
      if (count <= 1) delete inventory[action.itemId];
      else inventory[action.itemId] = count - 1;

      const targetStatId = item.effectStatId || c.playerHpStatId;
      const amount = item.effectAmount ?? 8;
      if (targetStatId === c.playerHpStatId) {
        playerHp = Math.min(maxHp, playerHp + amount);
        stats[c.playerHpStatId] = playerHp;
      } else {
        stats[targetStatId] = (stats[targetStatId] ?? 0) + amount;
      }
      const targetDef = project.rpgConfig.stats.find((s) => s.id === targetStatId);
      c.log.push(
        `${rt.used} ${item.name} (+${amount} ${targetDef?.name ?? targetStatId}).`
      );
      event = 'heal';
    }
  }

  // Enemy counterattack
  const minAtk = Math.min(c.enemyAttackMin, c.enemyAttackMax);
  const maxAtk = Math.max(c.enemyAttackMin, c.enemyAttackMax);
  let enemyDmg = minAtk + Math.floor(Math.random() * (maxAtk - minAtk + 1));
  if (c.defending) {
    enemyDmg = Math.max(1, Math.floor(enemyDmg * 0.4));
  }
  playerHp = Math.max(0, playerHp - enemyDmg);
  stats[c.playerHpStatId] = playerHp;
  c.log.push(
    `${c.enemyName} ${rt.attacksFor} ${enemyDmg} ${rt.damage}${c.defending ? ` ${rt.guarded}` : ''}.`
  );

  if (playerHp <= 0) {
    c.resolved = 'defeat';
    c.log.push(rt.youCollapse);
    event = 'defeat';
  }

  return {
    session: {
      ...session,
      stats,
      inventory,
      combat: c,
    },
    event,
  };
}

/**
 * Extracts inline Twine-style [[Label->Target]] or [[Target]] links from prose.
 */
export function parseInlineLinks(body: string): Array<{ label: string; targetTitle: string }> {
  const regex = /\[\[([^\]]+)\]\]/g;
  const results: Array<{ label: string; targetTitle: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.toLowerCase().startsWith('img:')) continue;
    const arrowIndex = raw.indexOf('->');
    if (arrowIndex !== -1) {
      const label = raw.slice(0, arrowIndex).trim();
      const targetTitle = raw.slice(arrowIndex + 2).trim();
      if (label && targetTitle) results.push({ label, targetTitle });
    } else {
      results.push({ label: raw, targetTitle: raw });
    }
  }
  return results;
}

/**
 * Splits passage prose into ordered text paragraphs and inline [[img:assetId|caption|size]] figures.
 */
export function parseBodyBlocks(body: string): BodyBlock[] {
  const regex = /\[\[img:([^\]|]+)(?:\|([^\]|]*))?(?:\|(25|50|75))?\]\]/gi;
  const blocks: BodyBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = body.slice(lastIndex, match.index).trim();
      if (textChunk) {
        blocks.push({ type: 'text', content: textChunk });
      }
    }
    const assetId = match[1].trim();
    const caption = (match[2] || '').trim();
    const parsedSize = match[3] ? (Number(match[3]) as InlineImageSize) : 75;
    blocks.push({
      type: 'image',
      assetId,
      caption,
      size: parsedSize,
      rawToken: match[0],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    const tail = body.slice(lastIndex).trim();
    if (tail) {
      blocks.push({ type: 'text', content: tail });
    }
  }

  return blocks;
}

/**
 * Collects all outgoing passage IDs from a passage (choices + skillCheck + combat)
 * for drawing connections on the visual Story Map.
 */
export interface PassageConnection {
  fromId: string;
  toId: string;
  label: string;
  kind: 'choice' | 'conditional' | 'check_pass' | 'check_fail' | 'combat_win' | 'combat_loss';
}

export function getPassageConnections(passage: Passage): PassageConnection[] {
  const links: PassageConnection[] = [];

  for (const choice of passage.choices) {
    if (choice.targetPassageId) {
      links.push({
        fromId: passage.id,
        toId: choice.targetPassageId,
        label: choice.label || 'Choice',
        kind: choice.condition ? 'conditional' : 'choice',
      });
    }
  }

  if (passage.skillCheck) {
    if (passage.skillCheck.successPassageId) {
      links.push({
        fromId: passage.id,
        toId: passage.skillCheck.successPassageId,
        label: `${passage.skillCheck.label} (Pass)`,
        kind: 'check_pass',
      });
    }
    if (passage.skillCheck.failurePassageId) {
      links.push({
        fromId: passage.id,
        toId: passage.skillCheck.failurePassageId,
        label: `${passage.skillCheck.label} (Fail)`,
        kind: 'check_fail',
      });
    }
  }

  if (passage.combat) {
    if (passage.combat.victoryPassageId) {
      links.push({
        fromId: passage.id,
        toId: passage.combat.victoryPassageId,
        label: 'Combat Victory',
        kind: 'combat_win',
      });
    }
    if (passage.combat.defeatPassageId) {
      links.push({
        fromId: passage.id,
        toId: passage.combat.defeatPassageId,
        label: 'Combat Defeat',
        kind: 'combat_loss',
      });
    }
    if (passage.combat.fleePassageId) {
      links.push({
        fromId: passage.id,
        toId: passage.combat.fleePassageId,
        label: 'Flee',
        kind: 'choice',
      });
    }
  }

  return links;
}
