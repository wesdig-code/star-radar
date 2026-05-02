declare global {
	namespace App {
		interface Error {
			code?: string;
		}
		interface Locals {}
		interface PageData {}
		interface PageState {}
		interface Platform {
			env?: {
				MAPTILER_KEY?: string;
			};
		}
	}
}

export {};
