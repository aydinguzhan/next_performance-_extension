export const extensionStorage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const result = await chrome.storage.sync.get(key);
    return (result[key] as T | undefined) ?? fallback;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  },

  async getLocal<T>(key: string, fallback: T): Promise<T> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? fallback;
  },

  async setLocal<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async removeLocal(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
};
