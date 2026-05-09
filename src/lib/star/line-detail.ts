import type { TripStopsIndex, Vehicle } from './types';

type StopRef = { id: string; name: string };

export type VehicleRowStatus = 'transit' | 'stopped' | 'departure' | 'arrived' | 'unknown';

export interface VehicleStops {
	prev: StopRef | null;
	next: StopRef | null;
	current: StopRef | null;
	status: VehicleRowStatus;
}

function refOf(stopId: string | null, index: TripStopsIndex): StopRef | null {
	if (!stopId) return null;
	return { id: stopId, name: index.stopNames[stopId] ?? stopId };
}

export function computeVehicleStops(vehicle: Vehicle, index: TripStopsIndex): VehicleStops {
	const tripId = vehicle.tripId;
	if (!tripId) return { prev: null, next: null, current: null, status: 'unknown' };
	const patternIdx = index.trips[tripId];
	if (patternIdx === undefined) return { prev: null, next: null, current: null, status: 'unknown' };
	const pattern = index.patterns[patternIdx];
	if (!pattern || !vehicle.stopId)
		return { prev: null, next: null, current: null, status: 'unknown' };

	const idx = pattern.stops.indexOf(vehicle.stopId);
	if (idx < 0) return { prev: null, next: null, current: null, status: 'unknown' };

	if (vehicle.currentStatus === 'STOPPED_AT') {
		// `current` is what the bus is desserving right now — the only one a
		// rider needs in this state. `prev` and `next` round out the adjacency
		// for callers that want it.
		const prev = idx > 0 ? pattern.stops[idx - 1] : null;
		const next = idx < pattern.stops.length - 1 ? pattern.stops[idx + 1] : null;
		return {
			prev: refOf(prev, index),
			next: refOf(next, index),
			current: refOf(pattern.stops[idx], index),
			status: 'stopped'
		};
	}

	// IN_TRANSIT_TO / INCOMING_AT / unspecified — stopId is the upcoming stop.
	const isStart = idx === 0;
	const isEnd = idx === pattern.stops.length - 1;
	const prev = isStart ? null : pattern.stops[idx - 1];
	return {
		prev: refOf(prev, index),
		next: refOf(pattern.stops[idx], index),
		current: null,
		status: isStart ? 'departure' : isEnd ? 'arrived' : 'transit'
	};
}

export interface DirectionGroup {
	headsign: string;
	direction: number;
	vehicles: Vehicle[];
}

export function groupByDirection(vehicles: Vehicle[], index: TripStopsIndex): DirectionGroup[];
export function groupByDirection(
	vehicles: Vehicle[],
	index: TripStopsIndex,
	options: { withOrphans: true }
): { groups: DirectionGroup[]; orphans: Vehicle[] };
export function groupByDirection(
	vehicles: Vehicle[],
	index: TripStopsIndex,
	options?: { withOrphans?: boolean }
): DirectionGroup[] | { groups: DirectionGroup[]; orphans: Vehicle[] } {
	const map = new Map<string, DirectionGroup>();
	const orphans: Vehicle[] = [];
	for (const v of vehicles) {
		const tripId = v.tripId;
		const patternIdx = tripId != null ? index.trips[tripId] : undefined;
		if (patternIdx === undefined) {
			orphans.push(v);
			continue;
		}
		const pattern = index.patterns[patternIdx];
		const key = `${pattern.direction}|${pattern.headsign}`;
		const g = map.get(key) ?? {
			headsign: pattern.headsign,
			direction: pattern.direction,
			vehicles: []
		};
		g.vehicles.push(v);
		map.set(key, g);
	}
	const groups = [...map.values()].sort((a, b) => a.direction - b.direction);
	if (options?.withOrphans) return { groups, orphans };
	return groups;
}
