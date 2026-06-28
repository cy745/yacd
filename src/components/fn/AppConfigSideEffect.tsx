import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { saveState } from '$src/misc/storage';
import { throttle } from '$src/misc/utils';
import {
  autoCloseOldConnsAtom,
  collapsibleIsOpenAtom,
  hideUnavailableProxiesAtom,
  latencyTestUrlAtom,
  logStreamingPausedAtom,
  proxySortByAtom,
  selectedChartStyleIndexAtom,
  themeAtom,
} from '$src/store/app';
import { StateApp } from '$src/store/types';

let stateRef: StateApp;

function save0() {
  if (stateRef) saveState(stateRef);
}

const save = throttle(save0, 500);

export function AppConfigSideEffect() {
  const [latencyTestUrl] = useAtom(latencyTestUrlAtom);
  const [selectedChartStyleIndex] = useAtom(selectedChartStyleIndexAtom);
  const [theme] = useAtom(themeAtom);
  const [collapsibleIsOpen] = useAtom(collapsibleIsOpenAtom);
  const [proxySortBy] = useAtom(proxySortByAtom);
  const [hideUnavailableProxies] = useAtom(hideUnavailableProxiesAtom);
  const [autoCloseOldConns] = useAtom(autoCloseOldConnsAtom);
  const [logStreamingPaused] = useAtom(logStreamingPausedAtom);
  useEffect(() => {
    stateRef = {
      autoCloseOldConns,
      collapsibleIsOpen,
      hideUnavailableProxies,
      latencyTestUrl,
      logStreamingPaused,
      proxySortBy,
      selectedChartStyleIndex,
      theme,
    };
    save();
  }, [
    autoCloseOldConns,
    collapsibleIsOpen,
    hideUnavailableProxies,
    latencyTestUrl,
    logStreamingPaused,
    proxySortBy,
    selectedChartStyleIndex,
    theme,
  ]);
  return null;
}
