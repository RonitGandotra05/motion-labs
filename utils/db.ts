import { ElementType, EditorElement, Track } from "../types";

const DB_NAME = 'ReactFrameDB';
const MEDIA_STORE = 'media_assets';
const PROJECT_STORE = 'project_state';
const DB_VERSION = 2; // Incremented to add project_state store

export interface MediaAsset {
  id: string;
  name: string;
  type: ElementType;
  blob: Blob;
  createdAt: number;
}

export interface ProjectData {
  id: string; // Always 'current' for single project
  elements: EditorElement[];
  tracks: Track[];
  updatedAt: number;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create media_assets store if doesn't exist
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }

      // Create project_state store if doesn't exist
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
    };
  });
};

// ==================== MEDIA ASSET FUNCTIONS ====================

export const saveAsset = async (file: File | Blob, type: ElementType, name: string): Promise<MediaAsset> => {
  const db = await initDB();
  const id = Math.random().toString(36).substr(2, 9);
  const asset: MediaAsset = {
    id,
    name,
    type,
    blob: file,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const request = store.add(asset);

    request.onsuccess = () => resolve(asset);
    request.onerror = () => reject(request.error);
  });
};

export const getAssets = async (): Promise<MediaAsset[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by newest first
      const results = request.result as MediaAsset[];
      resolve(results.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAssetById = async (id: string): Promise<MediaAsset | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteAsset = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ==================== PROJECT STATE FUNCTIONS ====================

export const saveProjectState = async (elements: EditorElement[], tracks: Track[]): Promise<void> => {
  const db = await initDB();

  // Remove blob URLs from elements (they don't persist)
  const elementsToSave = elements.map(el => {
    if (el.props.src?.startsWith('blob:')) {
      const { src, ...restProps } = el.props;
      return { ...el, props: restProps };
    }
    return el;
  });

  const projectData: ProjectData = {
    id: 'current',
    elements: elementsToSave,
    tracks,
    updatedAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE);
    const request = store.put(projectData); // Use put to upsert

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadProjectState = async (): Promise<{ elements: EditorElement[], tracks: Track[] } | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const store = tx.objectStore(PROJECT_STORE);
    const request = store.get('current');

    request.onsuccess = () => {
      const data = request.result as ProjectData | undefined;
      if (data) {
        resolve({ elements: data.elements, tracks: data.tracks });
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
};