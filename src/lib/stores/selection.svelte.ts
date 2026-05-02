export type Selection =
	| { kind: 'none' }
	| { kind: 'line'; lineCode: string }
	| { kind: 'stop'; stopId: string }
	| { kind: 'vehicle'; vehicleId: string };

class SelectionStore {
	current = $state<Selection>({ kind: 'none' });

	selectLine(lineCode: string): void {
		this.current = { kind: 'line', lineCode };
	}
	selectStop(stopId: string): void {
		this.current = { kind: 'stop', stopId };
	}
	selectVehicle(vehicleId: string): void {
		this.current = { kind: 'vehicle', vehicleId };
	}
	clear(): void {
		this.current = { kind: 'none' };
	}
}

export const selectionStore = new SelectionStore();
