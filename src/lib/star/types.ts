/**
 * Domain types shared across client and server.
 * Vehicle and Stop shapes match what `/api/*` endpoints emit.
 */

export type LineMode = 'bus' | 'metro';

export interface Line {
	id: string;
	code: string;
	name: string;
	mode: LineMode;
	color: string;
	textColor: string;
	gtfsRouteId?: string;
}

export interface Stop {
	id: string;
	code: string;
	name: string;
	lng: number;
	lat: number;
	lineCodes: string[];
	wheelchair: boolean;
}

export interface Vehicle {
	id: string;
	tripId?: string;
	routeId?: string;
	lineCode?: string;
	bearing?: number;
	speed?: number;
	lng: number;
	lat: number;
	timestamp: number;
}

export interface VehicleSnapshot {
	updatedAt: number;
	source: 'live' | 'stale';
	vehicles: Vehicle[];
}

export interface NextPassage {
	stopId: string;
	lineCode: string;
	destination: string;
	departure: number;
	scheduled: number;
	delaySeconds: number;
	precision: 'realtime' | 'theoretical';
}

/**
 * GTFS-RT alert effect classes we filter on for the metro banner (#6).
 * Anything outside this set is not "significant enough" to push a forced
 * banner — but it can still appear in the network drawer (#3).
 */
export type SignificantAlertEffect =
	| 'NO_SERVICE'
	| 'REDUCED_SERVICE'
	| 'SIGNIFICANT_DELAYS'
	| 'DETOUR';

export interface NetworkAlert {
	id: string;
	header: string;
	description?: string;
	url?: string;
	effect:
		| SignificantAlertEffect
		| 'STOP_MOVED'
		| 'OTHER_EFFECT'
		| 'UNKNOWN_EFFECT'
		| 'ADDITIONAL_SERVICE'
		| 'MODIFIED_SERVICE'
		| 'ACCESSIBILITY_ISSUE';
	cause?: string;
	affectedRoutes: string[];
	affectedStops: string[];
	start?: number;
	end?: number;
}

export interface DelayedLine {
	routeId: string;
	routeShortName: string;
	avgDelayMin: number | null;
	affectedTrips: number;
}

export interface CancelledLine {
	routeId: string;
	routeShortName: string;
	cancelledTrips: number;
}

export interface NetworkHealth {
	updatedAt: string;
	delayedLines: DelayedLine[];
	cancelledLines: CancelledLine[];
	alerts: NetworkAlert[];
}
