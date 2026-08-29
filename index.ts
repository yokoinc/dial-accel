import { PluginSDK } from '@logitech/plugin-sdk';

import { OhifScrollAction } from './src/dial-actions';
import { shutdownInput, warmUpInput } from './src/win-input';

const pluginSDK = new PluginSDK();

console.log('[dial-accel] demarrage du plugin');
warmUpInput();

pluginSDK.registerAction(new OhifScrollAction());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    shutdownInput();
    process.exit(0);
  });
}

await pluginSDK.connect();
