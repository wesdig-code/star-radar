import { describe, expect, it } from 'vitest';
import { computeVehicleStops, groupByDirection } from './line-detail';
import type { TripStopsIndex, Vehicle } from './types';

const index: TripStopsIndex = {
	patterns: [
		{ stops: ['s1', 's2', 's3'], headsign: 'Vers République', direction: 0 },
		{ stops: ['s3', 's2', 's1'], headsign: 'Vers Cesson', direction: 1 }
	],
	trips: { 'trip-A': 0, 'trip-B': 1 },
	stopNames: { s1: 'Donzelot', s2: 'Gallet', s3: 'Métro Cesson' }
};

function v(over: Partial<Vehicle>): Vehicle {
	return { id: 'v', lng: 0, lat: 0, timestamp: 0, ...over };
}

describe('computeVehicleStops', () => {
	it('returns prev=null and next=stopId when bus is at the first stop, in transit', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's1', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(r.status).toBe('departure');
		expect(r.prev).toBeNull();
		expect(r.next).toEqual({ id: 's1', name: 'Donzelot' });
	});

	it('returns prev = previous stop and next = stopId in transit mid-trip', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(r.status).toBe('transit');
		expect(r.prev).toEqual({ id: 's1', name: 'Donzelot' });
		expect(r.next).toEqual({ id: 's2', name: 'Gallet' });
	});

	it('returns stopped state when STOPPED_AT, with current = stopId, prev = previous, next = next-after', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'STOPPED_AT' }),
			index
		);
		expect(r.status).toBe('stopped');
		expect(r.current).toEqual({ id: 's2', name: 'Gallet' });
		expect(r.prev).toEqual({ id: 's1', name: 'Donzelot' });
		expect(r.next).toEqual({ id: 's3', name: 'Métro Cesson' });
	});

	it('leaves current = null in transit / departure / arrived states', () => {
		const transit = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(transit.current).toBeNull();
		const departure = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's1', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(departure.current).toBeNull();
		const arrived = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's3', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(arrived.current).toBeNull();
	});

	it('returns terminus state when next stop is the last in the pattern, in transit', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's3', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(r.status).toBe('arrived');
		expect(r.prev).toEqual({ id: 's2', name: 'Gallet' });
		expect(r.next).toEqual({ id: 's3', name: 'Métro Cesson' });
	});

	it('returns unknown when tripId is missing', () => {
		const r = computeVehicleStops(v({ stopId: 's2' }), index);
		expect(r.status).toBe('unknown');
		expect(r.prev).toBeNull();
		expect(r.next).toBeNull();
	});

	it('returns unknown when tripId is not in the index', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-Z', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(r.status).toBe('unknown');
	});

	it('returns unknown when stopId is not present in the trip pattern', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 'unknown-stop', currentStatus: 'IN_TRANSIT_TO' }),
			index
		);
		expect(r.status).toBe('unknown');
	});

	it('falls back to the stop id as name when the stop id is not in stopNames', () => {
		const sparseIndex: TripStopsIndex = {
			...index,
			stopNames: { s1: 'Donzelot', s3: 'Métro Cesson' } // s2 missing
		};
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			sparseIndex
		);
		expect(r.next).toEqual({ id: 's2', name: 's2' });
	});
});

describe('groupByDirection', () => {
	it('groups vehicles by (direction, headsign), preserves all matched, sorts by direction asc', () => {
		const vehicles = [
			v({ id: 'va', tripId: 'trip-A' }),
			v({ id: 'vb', tripId: 'trip-B' }),
			v({ id: 'va2', tripId: 'trip-A' })
		];
		const groups = groupByDirection(vehicles, index);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toMatchObject({ headsign: 'Vers République', direction: 0 });
		expect(groups[0].vehicles.map((x) => x.id)).toEqual(['va', 'va2']);
		expect(groups[1]).toMatchObject({ headsign: 'Vers Cesson', direction: 1 });
	});

	it('returns vehicles with unknown trip in a separate "orphans" array', () => {
		const vehicles = [
			v({ id: 'va', tripId: 'trip-A' }),
			v({ id: 'vorphan' }),
			v({ id: 'vbad', tripId: 'trip-Z' })
		];
		const { orphans } = groupByDirection(vehicles, index, { withOrphans: true });
		expect(orphans?.map((x) => x.id).sort()).toEqual(['vbad', 'vorphan']);
	});
});
