import { ScanResult, GreenGramPost } from '../types';

const SCAN_HISTORY_KEY = 'growSmartScanHistory';
const GREEN_GRAM_POSTS_KEY = 'growSmartGreenGramPosts';
const MAX_HISTORY_ITEMS = 12;
const MAX_POST_ITEMS = 20; // Keep a reasonable limit for posts

// Generic getter and setter
const getItem = <T,>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return null;
  }
};

const setItem = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
};

// Scan History
export const getScanHistory = (): ScanResult[] => {
  return getItem<ScanResult[]>(SCAN_HISTORY_KEY) || [];
};

export const addScanResult = (result: ScanResult): void => {
  const history = getScanHistory();
  const updatedHistory = [result, ...history].slice(0, MAX_HISTORY_ITEMS);
  setItem(SCAN_HISTORY_KEY, updatedHistory);
};

export const deleteScanHistoryItem = (id: string): void => {
  const history = getScanHistory();
  const updated = history.filter(item => item.id !== id);
  setItem(SCAN_HISTORY_KEY, updated);
};

export const clearScanHistory = (): void => {
  setItem(SCAN_HISTORY_KEY, []);
};

// GreenGram Posts
export const getGreenGramPosts = (): GreenGramPost[] => {
  return getItem<GreenGramPost[]>(GREEN_GRAM_POSTS_KEY) || [];
};

export const addGreenGramPost = (post: GreenGramPost): void => {
  const posts = getGreenGramPosts();
  const updatedPosts = [post, ...posts].slice(0, MAX_POST_ITEMS);
  setItem(GREEN_GRAM_POSTS_KEY, updatedPosts);
};

export const deleteGreenGramPost = (postId: string): void => {
  const posts = getGreenGramPosts();
  const updatedPosts = posts.filter(post => post.id !== postId);
  setItem(GREEN_GRAM_POSTS_KEY, updatedPosts);
};

export const clearGreenGramPosts = (): void => {
  setItem(GREEN_GRAM_POSTS_KEY, []);
};
