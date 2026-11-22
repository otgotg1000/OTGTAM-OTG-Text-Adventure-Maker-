import { StoryGenre, StoryLayoutId, StoryProject, StudioThemeId } from '../types/story';
import { BUILTIN_ASSETS } from './starterProject';
import { getDefaultLayoutForGenre } from './themes';

export interface GenreDefinition {
  id: StoryGenre;
  name: string;
  tagline: string;
  defaultSystemSummary: string;
  hudLabels: {
    statsTitle: string;
    inventoryTitle: string;
    questsTitle: string;
    factionsTitle: string;
  };
}

export const GENRE_DEFINITIONS: GenreDefinition[] = [
  {
    id: 'rpg',
    name: 'Fantasy & RPG',
    tagline: 'Quests, tactical combat encounters, loot, and dungeon exploration.',
    defaultSystemSummary: 'Health & Aether bars · Strength & Perception · Combat & Loot · Guild Factions',
    hudLabels: {
      statsTitle: 'Character Stats',
      inventoryTitle: 'Inventory',
      questsTitle: 'Quest Log',
      factionsTitle: 'Faction Reputation',
    },
  },
  {
    id: 'mystery',
    name: 'Mystery & Detective',
    tagline: 'Clue gathering, suspect interrogations, and deduction checks.',
    defaultSystemSummary: 'Composure & Intuition · Evidence Bag · Case Leads · Suspect Trust',
    hudLabels: {
      statsTitle: 'Investigator Profile',
      inventoryTitle: 'Evidence & Clues',
      questsTitle: 'Case Leads',
      factionsTitle: 'Suspect & Witness Trust',
    },
  },
  {
    id: 'scifi',
    name: 'Sci-Fi & Cyberpunk',
    tagline: 'Starship emergencies, terminal hacking, credits, and cybernetic gear.',
    defaultSystemSummary: 'Suit Integrity & Energy · Hacking & Tech · Directives · Syndicate Standing',
    hudLabels: {
      statsTitle: 'Suit & Systems',
      inventoryTitle: 'Tech & Cargo',
      questsTitle: 'Mission Directives',
      factionsTitle: 'Faction Standing',
    },
  },
  {
    id: 'horror',
    name: 'Horror & Survival',
    tagline: 'Sanity management, scarce supplies, stealth checks, and dread.',
    defaultSystemSummary: 'Sanity & Health · Willpower & Stealth · Survival Pack · Survivor Trust',
    hudLabels: {
      statsTitle: 'Survival Vitals',
      inventoryTitle: 'Supplies',
      questsTitle: 'Objectives',
      factionsTitle: 'Group Morale & Trust',
    },
  },
  {
    id: 'romance',
    name: 'Romance & Drama',
    tagline: 'Relationship choices, emotional milestones, keepsakes, and endings.',
    defaultSystemSummary: 'Confidence & Empathy · Keepsakes · Story Milestones · Character Affection',
    hudLabels: {
      statsTitle: 'Personal Traits',
      inventoryTitle: 'Keepsakes & Notes',
      questsTitle: 'Story Milestones',
      factionsTitle: 'Character Affection',
    },
  },
  {
    id: 'interactive',
    name: 'Interactive Fiction & Blog',
    tagline: 'Branching literary stories, illustrated essays, and visual journals.',
    defaultSystemSummary: 'Lightweight Energy & Mood · Story Notes · Chapter Checkpoints',
    hudLabels: {
      statsTitle: 'Story Meters',
      inventoryTitle: 'Collected Notes',
      questsTitle: 'Chapters & Goals',
      factionsTitle: 'Connections',
    },
  },
];

export function getGenreDefinition(genre?: StoryGenre): GenreDefinition {
  return (
    GENRE_DEFINITIONS.find((g) => g.id === genre) || GENRE_DEFINITIONS[0]
  );
}

export function createProjectFromGenre(
  genre: StoryGenre,
  customTitle?: string,
  customAuthor?: string,
  customSubtitle?: string,
  storyTheme?: StudioThemeId,
  storyLayout?: StoryLayoutId
): StoryProject {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const author = customAuthor?.trim() || 'Author';
  const subtitleOverride = customSubtitle?.trim();
  const resolvedLayout = storyLayout || getDefaultLayoutForGenre(genre);

  if (genre === 'mystery') {
    return {
      id,
      version: 1,
      updatedAt: now,
      meta: {
        title: customTitle?.trim() || 'The Midnight Study Case',
        author,
        subtitle:
          subtitleOverride ||
          'A branching detective investigation with evidence locks and deduction checks.',
        genre: 'mystery',
        startPassageId: 'p_study',
        storyTheme,
        storyLayout: resolvedLayout,
      },
      rpgConfig: {
        stats: [
          { id: 'composure', name: 'Composure', initial: 16, min: 0, max: 20, display: 'bar' },
          { id: 'intuition', name: 'Intuition', initial: 5, min: 1, max: 20, display: 'attribute' },
          { id: 'forensics', name: 'Forensics', initial: 4, min: 1, max: 20, display: 'attribute' },
          { id: 'clues', name: 'Clues Found', initial: 0, min: 0, max: 99, display: 'currency' },
        ],
        items: [
          {
            id: 'item_ledger',
            name: 'Charred Ledger',
            category: 'key',
            description: 'Half-burned account book recovered from the hearth.',
          },
          {
            id: 'item_espresso',
            name: 'Strong Espresso',
            category: 'consumable',
            description: 'Steadies nerves and restores +6 Composure.',
            effectStatId: 'composure',
            effectAmount: 6,
          },
        ],
        quests: [
          {
            id: 'q_motive',
            title: 'Uncover the Forged Signature',
            description: 'Examine the private study for proof of financial tampering.',
            initialStatus: 'active',
          },
        ],
        factions: [
          {
            id: 'fac_inspector',
            name: 'Inspector Vance',
            description: 'Lead detective overseeing the precinct.',
            initialReputation: 5,
          },
          {
            id: 'fac_heir',
            name: 'Lady Clara',
            description: 'Sole witness present on the night of the theft.',
            initialReputation: 0,
          },
        ],
      },
      assets: [...BUILTIN_ASSETS],
      passages: {
        p_study: {
          id: 'p_study',
          title: 'The Ransacked Study',
          tags: ['Crime Scene'],
          color: 'sky',
          x: 96,
          y: 192,
          imageId: 'img_vault',
          ambientAudioId: 'amb_rainstorm',
          entrySfxId: 'sfx_door',
          body:
            'Rain lashes the tall study windows while an overturned brass astrolabe ticks unevenly beside the desk.\n\n[[img:img_vault|Notice the ash tray and open ledger shelf beside the hearth]]\n\nTwo possibilities present themselves before the constable arrives.',
          entryEffects: [],
          skillCheck: {
            id: 'sc_dust',
            label: 'Examine Hearth for Hidden Evidence',
            statId: 'intuition',
            dice: 'd20',
            difficulty: 12,
            successPassageId: 'p_clue_found',
            failurePassageId: 'p_false_trail',
            successEffects: [
              { id: 'ef_m1', kind: 'item', itemId: 'item_ledger', operation: 'give', quantity: 1 },
              { id: 'ef_m2', kind: 'stat', statId: 'clues', operation: 'add', value: 1 },
            ],
            failureEffects: [
              { id: 'ef_m3', kind: 'stat', statId: 'composure', operation: 'add', value: -3 },
            ],
          },
          choices: [
            {
              id: 'c_m_1',
              label: 'Confront Lady Clara with the charred ledger',
              targetPassageId: 'p_case_solved',
              condition: { kind: 'has_item', itemId: 'item_ledger' },
              effects: [
                { id: 'ef_mk1', kind: 'quest', questId: 'q_motive', status: 'completed' },
              ],
              sfxId: 'sfx_discovery',
            },
          ],
        },
        p_clue_found: {
          id: 'p_clue_found',
          title: 'The Charred Ledger',
          tags: ['Clue'],
          color: 'violet',
          x: 432,
          y: 96,
          body: 'Tucked behind the iron grate lies a partially burned ledger bearing a fresh wax stamp.',
          entryEffects: [],
          choices: [
            {
              id: 'c_cf_1',
              label: 'Return to the study and confront the witness',
              targetPassageId: 'p_case_solved',
              effects: [
                { id: 'ef_cf1', kind: 'quest', questId: 'q_motive', status: 'completed' },
              ],
            },
          ],
        },
        p_false_trail: {
          id: 'p_false_trail',
          title: 'Cold Trail',
          tags: ['Complication'],
          color: 'crimson',
          x: 432,
          y: 288,
          body: 'Soot smudges your gloves as footsteps echo down the corridor—someone else is still in the manor.',
          entryEffects: [
            { id: 'ef_ft1', kind: 'faction', factionId: 'fac_inspector', delta: -5 },
          ],
          choices: [
            {
              id: 'c_ft_1',
              label: 'Regroup at the study desk',
              targetPassageId: 'p_study',
              effects: [],
            },
          ],
        },
        p_case_solved: {
          id: 'p_case_solved',
          title: 'Case Closed',
          tags: ['Ending'],
          color: 'emerald',
          x: 768,
          y: 168,
          body: 'Presented with the ledger dates, the witness falters and confesses the true culprit before dawn.',
          entryEffects: [
            { id: 'ef_cs1', kind: 'faction', factionId: 'fac_inspector', delta: 15 },
          ],
          choices: [],
        },
      },
    };
  }

  if (genre === 'scifi') {
    return {
      id,
      version: 1,
      updatedAt: now,
      meta: {
        title: customTitle?.trim() || 'Station Horizon-9',
        author,
        subtitle:
          subtitleOverride ||
          'A sci-fi survival & cyberpunk infiltration story with terminal hacks and directives.',
        genre: 'scifi',
        startPassageId: 'p_airlock',
        storyTheme,
        storyLayout: resolvedLayout,
      },
      rpgConfig: {
        stats: [
          { id: 'integrity', name: 'Suit Integrity', initial: 24, min: 0, max: 24, display: 'bar' },
          { id: 'energy', name: 'Energy Cells', initial: 10, min: 0, max: 20, display: 'bar' },
          { id: 'hacking', name: 'Hacking', initial: 5, min: 1, max: 20, display: 'attribute' },
          { id: 'credits', name: 'Credits', initial: 120, min: 0, max: 99999, display: 'currency' },
        ],
        items: [
          {
            id: 'item_override',
            name: 'Root Override Chip',
            category: 'key',
            description: 'Bypasses orbital security bulkheads.',
          },
          {
            id: 'item_nanogel',
            name: 'Nano-Repair Gel',
            category: 'consumable',
            description: 'Seals suit breaches (+10 Suit Integrity).',
            effectStatId: 'integrity',
            effectAmount: 10,
          },
        ],
        quests: [
          {
            id: 'q_beacon',
            title: 'Restore Distress Beacon',
            description: 'Reach the main relay deck and override the lockdown.',
            initialStatus: 'active',
          },
        ],
        factions: [
          {
            id: 'fac_command',
            name: 'Orbital Command',
            description: 'Automated station oversight network.',
            initialReputation: 0,
          },
          {
            id: 'fac_freeports',
            name: 'Freeport Syndicate',
            description: 'Independent couriers operating in the outer ring.',
            initialReputation: 10,
          },
        ],
      },
      assets: [...BUILTIN_ASSETS],
      passages: {
        p_airlock: {
          id: 'p_airlock',
          title: 'Airlock Sector 4',
          tags: ['Start'],
          color: 'amber',
          x: 96,
          y: 192,
          ambientAudioId: 'amb_clockwork',
          entrySfxId: 'sfx_door',
          body: 'Emergency amber strips pulse across frosted bulkhead glass. A damaged terminal flickers beside the sealed lift.',
          entryEffects: [],
          skillCheck: {
            id: 'sc_hack',
            label: 'Siphon Override Codes from Terminal',
            statId: 'hacking',
            dice: 'd20',
            difficulty: 12,
            successPassageId: 'p_bridge',
            failurePassageId: 'p_drone',
            successEffects: [
              { id: 'ef_sf1', kind: 'item', itemId: 'item_override', operation: 'give', quantity: 1 },
              { id: 'ef_sf2', kind: 'quest', questId: 'q_beacon', status: 'completed' },
            ],
            failureEffects: [],
          },
          choices: [
            {
              id: 'c_sf_1',
              label: 'Force the maintenance hatch',
              targetPassageId: 'p_drone',
              effects: [],
            },
          ],
        },
        p_drone: {
          id: 'p_drone',
          title: 'Patrol Drone Intercept',
          tags: ['Combat'],
          color: 'crimson',
          x: 432,
          y: 264,
          body: 'An automated security chassis drops from the ceiling rail, locking onto your suit transponder.',
          entryEffects: [],
          combat: {
            id: 'cmb_drone',
            enemyName: 'MK-IV Security Drone',
            enemyPortraitId: 'img_warden',
            enemyMaxHp: 16,
            enemyAttackMin: 3,
            enemyAttackMax: 5,
            enemyDefense: 1,
            playerHpStatId: 'integrity',
            playerAttackStatId: 'hacking',
            lootItemId: 'item_override',
            victoryPassageId: 'p_bridge',
            defeatPassageId: 'p_airlock',
          },
          choices: [],
        },
        p_bridge: {
          id: 'p_bridge',
          title: 'Observation Relay Deck',
          tags: ['Ending'],
          color: 'emerald',
          x: 768,
          y: 168,
          imageId: 'img_hall',
          body: 'The blast doors part onto a star-strewn observation deck. With the beacon back online, rescue telemetry locks onto your coordinates.',
          entryEffects: [],
          choices: [],
        },
      },
    };
  }

  if (genre === 'horror') {
    return {
      id,
      version: 1,
      updatedAt: now,
      meta: {
        title: customTitle?.trim() || 'Hollow Pines Manor',
        author,
        subtitle:
          subtitleOverride ||
          'A survival horror tale tracking sanity, scarce supplies, and perilous stealth checks.',
        genre: 'horror',
        startPassageId: 'p_foyer',
        storyTheme,
        storyLayout: resolvedLayout,
      },
      rpgConfig: {
        stats: [
          { id: 'sanity', name: 'Sanity', initial: 18, min: 0, max: 20, display: 'bar' },
          { id: 'hp', name: 'Health', initial: 20, min: 0, max: 20, display: 'bar' },
          { id: 'stealth', name: 'Stealth', initial: 4, min: 1, max: 20, display: 'attribute' },
          { id: 'willpower', name: 'Willpower', initial: 4, min: 1, max: 20, display: 'attribute' },
        ],
        items: [
          {
            id: 'item_lantern',
            name: 'Brass Storm Lantern',
            category: 'key',
            description: 'Cuts through oppressive darkness in the lower cellar.',
          },
          {
            id: 'item_bandage',
            name: 'Linen Bandage',
            category: 'consumable',
            description: 'Restores +8 Health.',
            effectStatId: 'hp',
            effectAmount: 8,
          },
        ],
        quests: [
          {
            id: 'q_escape',
            title: 'Escape Before Dawn',
            description: 'Find the cellar key and unlock the garden gate.',
            initialStatus: 'active',
          },
        ],
        factions: [
          {
            id: 'fac_survivors',
            name: 'Other Guests',
            description: 'Trust shared among those trapped inside.',
            initialReputation: 0,
          },
        ],
      },
      assets: [...BUILTIN_ASSETS],
      passages: {
        p_foyer: {
          id: 'p_foyer',
          title: 'The Whispering Foyer',
          tags: ['Start'],
          color: 'amber',
          x: 96,
          y: 192,
          imageId: 'img_gate',
          ambientAudioId: 'amb_dungeon',
          entrySfxId: 'sfx_door',
          body: 'The heavy front latch clicks shut behind you on its own. Upstairs, floorboards groan beneath slow, deliberate footsteps.',
          entryEffects: [],
          skillCheck: {
            id: 'sc_hide',
            label: 'Slip Silently Behind the Stairwell',
            statId: 'stealth',
            dice: 'd20',
            difficulty: 11,
            successPassageId: 'p_cellar',
            failurePassageId: 'p_panic',
            successEffects: [],
            failureEffects: [
              { id: 'ef_h1', kind: 'stat', statId: 'sanity', operation: 'add', value: -5 },
            ],
          },
          choices: [
            {
              id: 'c_h_1',
              label: 'Search the coat rack for a light source',
              targetPassageId: 'p_cellar',
              effects: [
                { id: 'ef_h2', kind: 'item', itemId: 'item_lantern', operation: 'give', quantity: 1 },
              ],
            },
          ],
        },
        p_panic: {
          id: 'p_panic',
          title: 'Shadows on the Landing',
          tags: ['Hazard'],
          color: 'crimson',
          x: 432,
          y: 288,
          body: 'A cold draft snuffs out the sconce beside you. Your pulse pounds as you sprint blindly toward the cellar stairs.',
          entryEffects: [],
          choices: [
            {
              id: 'c_pn_1',
              label: 'Barricade yourself in the cellar',
              targetPassageId: 'p_cellar',
              effects: [],
            },
          ],
        },
        p_cellar: {
          id: 'p_cellar',
          title: 'Garden Tunnel',
          tags: ['Safe Ending'],
          color: 'emerald',
          x: 768,
          y: 168,
          body: 'You unbolt the storm doors into cool night air—escaped safely into the pines.',
          entryEffects: [
            { id: 'ef_ce1', kind: 'quest', questId: 'q_escape', status: 'completed' },
          ],
          choices: [],
        },
      },
    };
  }

  if (genre === 'romance') {
    return {
      id,
      version: 1,
      updatedAt: now,
      meta: {
        title: customTitle?.trim() || 'Rain on Lantern Street',
        author,
        subtitle:
          subtitleOverride ||
          'A character-driven romance & drama story with affection meters, keepsakes, and branching endings.',
        genre: 'romance',
        startPassageId: 'p_cafe',
        storyTheme,
        storyLayout: resolvedLayout,
      },
      rpgConfig: {
        stats: [
          { id: 'confidence', name: 'Confidence', initial: 12, min: 0, max: 20, display: 'bar' },
          { id: 'empathy', name: 'Empathy', initial: 5, min: 1, max: 20, display: 'attribute' },
          { id: 'charm', name: 'Charm', initial: 4, min: 1, max: 20, display: 'attribute' },
        ],
        items: [
          {
            id: 'item_letter',
            name: 'Handwritten Postcard',
            category: 'key',
            description: 'A thoughtful note tucked inside a borrowed book.',
          },
          {
            id: 'item_tea',
            name: 'Warm Jasmine Tea',
            category: 'consumable',
            description: 'Calms nerves (+4 Confidence).',
            effectStatId: 'confidence',
            effectAmount: 4,
          },
        ],
        quests: [
          {
            id: 'q_festival',
            title: 'Attend the Lantern Festival Together',
            description: 'Share an honest evening before the autumn train departs.',
            initialStatus: 'active',
          },
        ],
        factions: [
          {
            id: 'fac_elena',
            name: 'Elena',
            description: 'Bookshop restorer with a quiet sense of humor.',
            initialReputation: 10,
          },
          {
            id: 'fac_julian',
            name: 'Julian',
            description: 'Childhood friend returning to town for the season.',
            initialReputation: 5,
          },
        ],
      },
      assets: [...BUILTIN_ASSETS],
      passages: {
        p_cafe: {
          id: 'p_cafe',
          title: 'The Corner Bookshop Café',
          tags: ['Opening'],
          color: 'amber',
          x: 96,
          y: 192,
          ambientAudioId: 'amb_hearth',
          entrySfxId: 'sfx_discovery',
          body: 'Rain blurs the amber streetlamps outside the bookshop window. Across the cedar table, Elena pauses with a half-folded postcard between her fingers.',
          entryEffects: [],
          skillCheck: {
            id: 'sc_read_room',
            label: 'Notice What She Hesitates to Say',
            statId: 'empathy',
            dice: '2d6',
            difficulty: 9,
            successPassageId: 'p_rooftop',
            failurePassageId: 'p_missed_cue',
            successEffects: [
              { id: 'ef_rm1', kind: 'faction', factionId: 'fac_elena', delta: 15 },
              { id: 'ef_rm2', kind: 'item', itemId: 'item_letter', operation: 'give', quantity: 1 },
            ],
            failureEffects: [],
          },
          choices: [
            {
              id: 'c_rm_1',
              label: 'Invite her to walk beneath the lanterns',
              targetPassageId: 'p_rooftop',
              effects: [
                { id: 'ef_rm3', kind: 'faction', factionId: 'fac_elena', delta: 10 },
                { id: 'ef_rm4', kind: 'quest', questId: 'q_festival', status: 'completed' },
              ],
            },
          ],
        },
        p_missed_cue: {
          id: 'p_missed_cue',
          title: 'Quiet Pause',
          tags: ['Drama'],
          color: 'violet',
          x: 432,
          y: 288,
          body: 'A polite smile lingers, leaving the unspoken words hanging softly between you.',
          entryEffects: [],
          choices: [
            {
              id: 'c_mc_1',
              label: 'Offer a warm umbrella for the walk home',
              targetPassageId: 'p_rooftop',
              effects: [
                { id: 'ef_mc1', kind: 'faction', factionId: 'fac_elena', delta: 8 },
              ],
            },
          ],
        },
        p_rooftop: {
          id: 'p_rooftop',
          title: 'Lantern Overlook',
          tags: ['Happy Ending'],
          color: 'emerald',
          x: 768,
          y: 168,
          body: 'Paper lanterns drift above the wet rooftops as the rain finally clears, marking the start of something lasting.',
          entryEffects: [],
          choices: [],
        },
      },
    };
  }

  if (genre === 'interactive') {
    return {
      id,
      version: 1,
      updatedAt: now,
      meta: {
        title: customTitle?.trim() || 'Letters from the Observatory',
        author,
        subtitle:
          subtitleOverride ||
          'An illustrated interactive story & blog-style narrative with inline images and soundscapes.',
        genre: 'interactive',
        startPassageId: 'p_chapter_1',
        storyTheme,
        storyLayout: resolvedLayout,
      },
      rpgConfig: {
        stats: [
          { id: 'mood', name: 'Mood', initial: 10, min: 0, max: 20, display: 'bar' },
          { id: 'curiosity', name: 'Curiosity', initial: 5, min: 0, max: 20, display: 'attribute' },
        ],
        items: [
          {
            id: 'item_journal',
            name: 'Observatory Field Notes',
            category: 'key',
            description: 'Annotated sketches collected along the walk.',
          },
        ],
        quests: [
          {
            id: 'q_ch1',
            title: 'Reach the Upper Dome',
            description: 'Document the mechanism and write the closing entry.',
            initialStatus: 'active',
          },
        ],
        factions: [],
      },
      assets: [...BUILTIN_ASSETS],
      passages: {
        p_chapter_1: {
          id: 'p_chapter_1',
          title: 'Chapter I: The Morning Walk',
          tags: ['Chapter 1'],
          color: 'sky',
          x: 96,
          y: 192,
          imageId: 'img_gate',
          ambientAudioId: 'amb_rainstorm',
          body:
            'Every interactive essay or story can weave imagery right inside the paragraphs, just like an illustrated journal.\n\n[[img:img_vault|Inside the lower archive where the old star charts are kept]]\n\nTake your time reading the notes or continue directly to the dome.',
          entryEffects: [
            { id: 'ef_if1', kind: 'item', itemId: 'item_journal', operation: 'give', quantity: 1 },
          ],
          choices: [
            {
              id: 'c_if_1',
              label: 'Climb to the upper observatory dome',
              targetPassageId: 'p_chapter_2',
              effects: [
                { id: 'ef_if2', kind: 'quest', questId: 'q_ch1', status: 'completed' },
              ],
              sfxId: 'sfx_discovery',
            },
          ],
        },
        p_chapter_2: {
          id: 'p_chapter_2',
          title: 'Chapter II: Under the Brass Pendulums',
          tags: ['Ending'],
          color: 'emerald',
          x: 456,
          y: 192,
          imageId: 'img_hall',
          ambientAudioId: 'amb_clockwork',
          body:
            'High above the stone steps, sunlight and moonlight trade places across the brass arches.\n\n[[img:img_hall|The vaulted dome illuminated at dusk]]\n\nHere your first chapter concludes.',
          entryEffects: [],
          choices: [],
        },
      },
    };
  }

  // Default: Fantasy & RPG
  return {
    id,
    version: 1,
    updatedAt: now,
    meta: {
      title: customTitle?.trim() || 'Untitled Fantasy Quest',
      author,
      subtitle:
        subtitleOverride ||
        'A fantasy RPG adventure with dice checks, inventory, quests, factions, and combat.',
      genre: 'rpg',
      startPassageId: 'p_start',
      storyTheme,
      storyLayout: resolvedLayout,
    },
    rpgConfig: {
      stats: [
        { id: 'hp', name: 'Health', initial: 25, min: 0, max: 25, display: 'bar' },
        { id: 'aether', name: 'Aether', initial: 10, min: 0, max: 20, display: 'bar' },
        { id: 'strength', name: 'Strength', initial: 5, min: 1, max: 20, display: 'attribute' },
        { id: 'perception', name: 'Perception', initial: 4, min: 1, max: 20, display: 'attribute' },
        { id: 'gold', name: 'Gold', initial: 20, min: 0, max: 9999, display: 'currency' },
      ],
      items: [
        {
          id: 'item_potion',
          name: 'Healing Draught',
          category: 'consumable',
          description: 'Restores 10 Health.',
          effectStatId: 'hp',
          effectAmount: 10,
        },
        {
          id: 'item_key',
          name: 'Iron Gate Key',
          category: 'key',
          description: 'Opens sealed sanctuary doors.',
        },
      ],
      quests: [
        {
          id: 'q_main',
          title: 'Explore the Crossroads',
          description: 'Chart your first quest path.',
          initialStatus: 'active',
        },
      ],
      factions: [
        {
          id: 'fac_guild',
          name: 'Wayfarers Guild',
          description: 'Adventurers and mapmakers.',
          initialReputation: 0,
        },
      ],
    },
    assets: [...BUILTIN_ASSETS],
    passages: {
      p_start: {
        id: 'p_start',
        title: 'Crossroads Tavern',
        tags: ['Start'],
        color: 'amber',
        x: 96,
        y: 192,
        ambientAudioId: 'amb_hearth',
        body: 'Lanterns swing gently over the crossroads sign. Use the One-Click toolbar to add inline images, soundscapes, dice checks, or combat.',
        entryEffects: [],
        choices: [
          {
            id: 'c_rpg_1',
            label: 'Follow the northern road',
            targetPassageId: 'p_road',
            effects: [],
          },
        ],
      },
      p_road: {
        id: 'p_road',
        title: 'Northern Watchtower',
        tags: ['Ending'],
        color: 'emerald',
        x: 456,
        y: 192,
        body: 'The watchtower beacon burns bright on the ridge ahead.',
        entryEffects: [
          { id: 'ef_r1', kind: 'quest', questId: 'q_main', status: 'completed' },
        ],
        choices: [],
      },
    },
  };
}
