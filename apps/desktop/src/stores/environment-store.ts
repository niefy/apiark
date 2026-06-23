import { create } from "zustand";
import type { EnvironmentData } from "@apiark/types";
import {
	loadEnvironments as loadEnvironmentsApi,
	getResolvedVariables as getResolvedVariablesApi,
	loadRootDotenv,
	loadPersistedState,
} from "@/lib/tauri-api";

interface EnvironmentState {
	environments: EnvironmentData[];
	activeEnvironmentName: string | null;
	activeCollectionPath: string | null;
	/** Runtime variable overrides from scripts (not persisted to disk) */
	runtimeOverrides: Record<string, string>;
	/** Whether we've attempted to restore the persisted environment */
	restored: boolean;

	loadEnvironments: (collectionPath: string) => Promise<void>;
	setActiveEnvironment: (name: string | null) => void;
	setActiveCollectionPath: (path: string | null) => void;
	getResolvedVariables: () => Promise<Record<string, string>>;
	applyMutations: (mutations: Record<string, string | null>) => void;
	restorePersistedEnvironment: () => Promise<void>;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
	environments: [],
	activeEnvironmentName: null,
	activeCollectionPath: null,
	runtimeOverrides: {},
	restored: false,

	/** Restore persisted environment selection from state.json on startup */
	restorePersistedEnvironment: async () => {
		if (get().restored) return;
		try {
			const persisted = await loadPersistedState();
			if (persisted.activeEnvironmentName) {
				set({
					activeEnvironmentName: persisted.activeEnvironmentName,
					activeCollectionPath: persisted.activeCollectionPath ?? null,
					restored: true,
				});
			} else {
				set({ restored: true });
			}
		} catch {
			set({ restored: true });
		}
	},

	loadEnvironments: async (collectionPath) => {
		try {
			const envs = await loadEnvironmentsApi(collectionPath);
			// Restore persisted environment on first load if not yet restored
			const state = get();
			if (!state.restored) {
				await state.restorePersistedEnvironment();
			}
			const persistedName = get().activeEnvironmentName;
			// Use persisted environment if it exists in the loaded list, otherwise auto-select first
			const matchedEnv = persistedName
				? envs.find((e) => e.name === persistedName)
				: undefined;
			set({
				environments: envs,
				activeCollectionPath: collectionPath,
				activeEnvironmentName:
					matchedEnv?.name ?? (envs.length > 0 ? envs[0].name : null),
			});
		} catch (err) {
			import("@/stores/toast-store").then(({ useToastStore }) =>
				useToastStore
					.getState()
					.showError(`Failed to load environments: ${err}`),
			);
		}
	},

	setActiveEnvironment: (name) => {
		set({ activeEnvironmentName: name });
		// Trigger persistence so the selection survives app restarts
		import("@/stores/tab-store").then(({ useTabStore }) => {
			useTabStore.getState().persistTabs();
		});
	},

	setActiveCollectionPath: (path) => {
		set({ activeCollectionPath: path });
	},

	getResolvedVariables: async () => {
		const { activeCollectionPath, activeEnvironmentName, runtimeOverrides } =
			get();
		if (!activeCollectionPath) {
			return { ...runtimeOverrides };
		}
		if (!activeEnvironmentName) {
			// No environment selected — still load root .env variables
			try {
				const rootVars = await loadRootDotenv(activeCollectionPath);
				return { ...rootVars, ...runtimeOverrides };
			} catch (err) {
				import("@/stores/toast-store").then(({ useToastStore }) =>
					useToastStore.getState().showWarning("Could not load .env file"),
				);
				return { ...runtimeOverrides };
			}
		}
		try {
			const resolved = await getResolvedVariablesApi(
				activeCollectionPath,
				activeEnvironmentName,
			);
			return { ...resolved, ...runtimeOverrides };
		} catch (err) {
			import("@/stores/toast-store").then(({ useToastStore }) =>
				useToastStore
					.getState()
					.showError(`Failed to resolve variables: ${err}`),
			);
			return { ...runtimeOverrides };
		}
	},

	applyMutations: (mutations) => {
		set((state) => {
			const overrides = { ...state.runtimeOverrides };
			for (const [key, value] of Object.entries(mutations)) {
				if (value === null) {
					delete overrides[key];
				} else {
					overrides[key] = value;
				}
			}
			return { runtimeOverrides: overrides };
		});
	},
}));
