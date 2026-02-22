declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React test utilities expect this flag when using act() in jsdom.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
