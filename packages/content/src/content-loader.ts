import type {
  GameData,
  Species,
  Move,
  Item,
  WorldMap,
  Location,
  Connection,
  StoryGraph,
  StoryNode,
  EffectivenessChart,
} from '@creature-chronicles/domain';
import { buildEffectivenessChart } from '@creature-chronicles/domain';
import { effectivenessData } from './effectiveness-chart.js';

import startersData from '../species/starters.json';
import wildData from '../species/wild.json';
import movesData from '../moves/moves.json';
import itemsData from '../items/items.json';
import worldData from '../world/world.json';
import storyData from '../story/prologue.json';

export function loadGameData(): GameData {
  const species = loadSpecies();
  const moves = loadMoves();
  const items = loadItems();
  const worldMap = loadWorldMap();
  const storyGraph = loadStoryGraph();
  const effectivenessChart = buildEffectivenessChart(effectivenessData);

  return { species, moves, items, worldMap, storyGraph, effectivenessChart };
}

function loadSpecies(): ReadonlyMap<string, Species> {
  const map = new Map<string, Species>();
  const allSpecies = [...(startersData as Species[]), ...(wildData as Species[])];
  for (const s of allSpecies) {
    map.set(s.id, s);
  }
  return map;
}

function loadMoves(): ReadonlyMap<string, Move> {
  const map = new Map<string, Move>();
  for (const m of movesData as Move[]) {
    map.set(m.id, m);
  }
  return map;
}

function loadItems(): ReadonlyMap<string, Item> {
  const map = new Map<string, Item>();
  for (const i of itemsData as Item[]) {
    map.set(i.id, i);
  }
  return map;
}

function loadWorldMap(): WorldMap {
  const locations = new Map<string, Location>();
  for (const loc of worldData.locations as unknown as Location[]) {
    locations.set(loc.id, loc);
  }

  const connections = new Map<string, readonly Connection[]>();
  const connData = worldData.connections as Record<string, Connection[]>;
  for (const [locId, conns] of Object.entries(connData)) {
    connections.set(locId, conns);
  }

  return { locations, connections };
}

function loadStoryGraph(): StoryGraph {
  const nodes = new Map<string, StoryNode>();
  for (const node of storyData as unknown as StoryNode[]) {
    nodes.set(node.id, node);
  }

  return { nodes, startNodeId: 'prologue-start' };
}
