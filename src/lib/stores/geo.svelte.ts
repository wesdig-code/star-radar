/**
 * Geolocation. We don't request on load: a permission prompt at cold-open
 * violates the brief's "civic, no friction" tone. The user opts in by tapping
 * the centre-on-me button or accepting the one-time nudge.
 */

const DISMISSED_KEY = 'sr.geo-nudge-dismissed';

type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

class GeoStore {
	permission = $state<PermissionState>('unknown');
	position = $state<{ lng: number; lat: number; accuracy: number } | null>(null);
	error = $state<string | null>(null);
	nudgeDismissed = $state(false);

	hydrate(): void {
		if (typeof localStorage !== 'undefined') {
			this.nudgeDismissed = localStorage.getItem(DISMISSED_KEY) === '1';
		}
		void this.queryPermission();
	}

	async queryPermission(): Promise<void> {
		if (typeof navigator === 'undefined' || !('permissions' in navigator)) return;
		try {
			const status = await navigator.permissions.query({ name: 'geolocation' });
			this.permission = status.state as PermissionState;
			status.addEventListener('change', () => {
				this.permission = status.state as PermissionState;
			});
		} catch {
			// Permissions API not available on Safari < 16 etc; leave as 'unknown'
		}
	}

	request(): void {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			this.permission = 'denied';
			this.error = 'Géolocalisation non supportée sur cet appareil.';
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				this.permission = 'granted';
				this.position = {
					lng: pos.coords.longitude,
					lat: pos.coords.latitude,
					accuracy: pos.coords.accuracy
				};
				this.error = null;
			},
			(err) => {
				this.permission = err.code === 1 ? 'denied' : 'prompt';
				this.error = err.message;
			},
			{ enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 }
		);
	}

	dismissNudge(): void {
		this.nudgeDismissed = true;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(DISMISSED_KEY, '1');
		}
	}
}

export const geoStore = new GeoStore();
