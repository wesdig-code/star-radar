import { describe, expect, it } from 'vitest';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchVehiclePositions } from './api';

const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
const VehicleStopStatus = GtfsRealtimeBindings.transit_realtime.VehiclePosition.VehicleStopStatus;

function makeFetchReturning(buf: Uint8Array): typeof fetch {
	return (async (url: string) => {
		// Lines endpoint not needed for this test — return an empty ODS response.
		if (typeof url === 'string' && url.includes('explore/v2.1/catalog/datasets')) {
			return new Response(JSON.stringify({ results: [], total_count: 0 }), { status: 200 });
		}
		// `new Response(Uint8Array)` works at runtime but lib.dom's BodyInit
		// has tightened its typings around `SharedArrayBuffer`; copy into a
		// plain ArrayBuffer-backed view so the type narrows cleanly.
		const ab = new ArrayBuffer(buf.byteLength);
		new Uint8Array(ab).set(buf);
		return new Response(ab, { status: 200 });
	}) as unknown as typeof fetch;
}

describe('fetchVehiclePositions — stop fields', () => {
	it('extracts currentStopSequence, stopId, currentStatus from VehiclePosition', async () => {
		const message = FeedMessage.create({
			header: { gtfsRealtimeVersion: '2.0', timestamp: 1_700_000_000 },
			entity: [
				{
					id: 'e1',
					vehicle: {
						vehicle: { id: 'bus-42' },
						trip: { tripId: 't-1', routeId: '6-0006' },
						position: { latitude: 48.1, longitude: -1.6 },
						timestamp: 1_700_000_000,
						currentStopSequence: 4,
						stopId: 'stop-7',
						currentStatus: VehicleStopStatus.STOPPED_AT
					}
				}
			]
		});
		const buf = FeedMessage.encode(message).finish();

		const { vehicles } = await fetchVehiclePositions(makeFetchReturning(buf));
		expect(vehicles).toHaveLength(1);
		expect(vehicles[0]).toMatchObject({
			id: 'bus-42',
			tripId: 't-1',
			currentStopSequence: 4,
			stopId: 'stop-7',
			currentStatus: 'STOPPED_AT'
		});
	});

	it('omits the three fields when the protobuf does not carry them', async () => {
		const message = FeedMessage.create({
			header: { gtfsRealtimeVersion: '2.0', timestamp: 1_700_000_000 },
			entity: [
				{
					id: 'e1',
					vehicle: {
						vehicle: { id: 'bus-only-position' },
						position: { latitude: 48.1, longitude: -1.6 }
					}
				}
			]
		});
		const buf = FeedMessage.encode(message).finish();

		const { vehicles } = await fetchVehiclePositions(makeFetchReturning(buf));
		expect(vehicles[0].currentStopSequence).toBeUndefined();
		expect(vehicles[0].stopId).toBeUndefined();
		expect(vehicles[0].currentStatus).toBeUndefined();
	});
});
