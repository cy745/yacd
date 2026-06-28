import { atom, useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useMemo } from 'react';

import { loadState } from '$src/misc/storage';
import { StateApp, ThemeType } from '$src/store/types';
import { ClashAPIConfig } from '$src/types';

let iState: StateApp;

const STORAGE_KEY = {
  darkModePureBlackToggle: 'yacd_darkModePureBlackToggle',
};

const rootEl = document.querySelector('html');

const defaultState: StateApp = {
  latencyTestUrl: 'http://www.gstatic.com/generate_204',
  selectedChartStyleIndex: 0,
  theme: 'dark',

  // type { [string]: boolean }
  collapsibleIsOpen: {},
  // how proxies are sorted in a group or provider
  proxySortBy: 'Natural',
  hideUnavailableProxies: false,
  autoCloseOldConns: false,
  logStreamingPaused: false,
};

// atoms

export const latencyTestUrlAtom = atom(initialState().latencyTestUrl);
export const selectedChartStyleIndexAtom = atom(initialState().selectedChartStyleIndex);
export const themeAtom = atom(initialState().theme);
export const collapsibleIsOpenAtom = atom(initialState().collapsibleIsOpen);
export const proxySortByAtom = atom(initialState().proxySortBy);
export const hideUnavailableProxiesAtom = atom(initialState().hideUnavailableProxies);
export const autoCloseOldConnsAtom = atom(initialState().autoCloseOldConns);
export const logStreamingPausedAtom = atom(initialState().logStreamingPaused);

// prettier-ignore
export const darkModePureBlackToggleAtom = atomWithStorage(STORAGE_KEY.darkModePureBlackToggle, false);

// hooks

const API_CONFIG: ClashAPIConfig = {
  baseURL: window.location.origin,
  secret: '',
};

export function useApiConfig(): ClashAPIConfig {
  const ref = useMemo(() => API_CONFIG, []);
  return ref;
}

function insertThemeColorMeta(color: string, media?: string) {
  const meta0 = document.createElement('meta');
  meta0.setAttribute('name', 'theme-color');
  meta0.setAttribute('content', color);
  if (media) meta0.setAttribute('media', media);
  document.head.appendChild(meta0);
}

function updateMetaThemeColor(theme: ThemeType) {
  const metas = Array.from(
    document.querySelectorAll('meta[name=theme-color]'),
  ) as HTMLMetaElement[];
  let meta0: HTMLMetaElement;
  for (const m of metas) {
    if (!m.getAttribute('media')) {
      meta0 = m;
    } else {
      document.head.removeChild(m);
    }
  }

  if (theme === 'auto') {
    insertThemeColorMeta('#eeeeee', '(prefers-color-scheme: light)');
    insertThemeColorMeta('#202020', '(prefers-color-scheme: dark)');
    if (meta0) {
      document.head.removeChild(meta0);
    } else {
      return;
    }
  } else {
    const color = theme === 'light' ? '#eeeeee' : '#202020';
    if (!meta0) {
      insertThemeColorMeta(color);
    } else {
      meta0.setAttribute('content', color);
    }
  }
}

export function setTheme(theme: ThemeType = 'dark') {
  if (theme === 'auto') {
    rootEl.setAttribute('data-theme', 'auto');
  } else if (theme === 'dark') {
    rootEl.setAttribute('data-theme', 'dark');
  } else {
    rootEl.setAttribute('data-theme', 'light');
  }
  updateMetaThemeColor(theme);
}

export function initialState(): StateApp {
  if (iState) return iState;

  let s = loadState();
  s = { ...defaultState, ...s };

  s.theme = s.theme || 'dark';
  // set initial theme
  setTheme(s.theme);

  iState = s;
  return s;
}
