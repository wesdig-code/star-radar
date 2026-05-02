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
