import emitter from 'lib/emitter';
import bip21 from 'lib/bip21';
import LS from 'lib/wallet/localStorage';
import initFrame from 'widgets/frame';
import initAuth from 'pages/auth';
import touchId from 'lib/touch-id';
import updater from 'lib/updater';
import querystring from 'querystring';
import { showError } from 'widgets/modals/flash';
import showTouchIdSetup from 'widgets/touch-id-setup';
import { fadeIn } from 'lib/transitions/fade.js';
import { translate } from 'lib/i18n';
import details from 'lib/wallet/details';
import i18n from 'lib/i18n';

window.initCSApp = async function() {

  const appEl = document.getElementById('app');

  setupBip21();
  setupCrypto();

  window.history.replaceState(null, null, window.location.href.split('?')[0]);

  if (process.env.BUILD_PLATFORM === 'ios') {
    window.StatusBar.setStyle('default');
    window.StatusBar.show();
    window.StatusBar.overlaysWebView(false);
    window.StatusBar.overlaysWebView(true);
  }
  if (process.env.BUILD_TYPE === 'phonegap') navigator.splashscreen.hide();

  await touchId.init();
  updater.init();

  const auth = initAuth(document.getElementById('auth'));
  const authContentEl = document.getElementById('auth_frame');
  authContentEl.style.opacity = 0;
  fadeIn(authContentEl);
  auth.show();

  emitter.on('auth-error', (err) => {
    if (err.status === 410 || err.status === 404) {
      LS.reset();
      return location.reload();
    }
    if (err.status === 401) {
      return;
    }
    if ([406, 500, 503].includes(err.status)) {
      return showError({ message: translate('Oops! something went wrong. Please try again later.') });
    }
    console.error(`not translated error: ${err.message}`);
    return showError({ message: err.message });
  });

  emitter.once('auth-success', async (pin) => {
    window.scrollTo(0, 0);
    if (process.env.BUILD_TYPE === 'phonegap') window.Zendesk.setAnonymousIdentity();
    await setLanguage();

    const frame = initFrame(appEl);
    if (pin && touchId.isAvailable()) {
      const touchIdSetupWidget = showTouchIdSetup({ append: true, pin });
      touchIdSetupWidget.on('close', () => {
        auth.hide();
        frame.show();
      });
    } else {
      auth.hide();
      frame.show();
    }
  });

  window.safeOpen = function(...args) {
    if (args[0].startsWith('https://support.coin.space/')) {
      const version = `${process.env.VERSION}@${process.env.PLATFORM} (${process.env.COMMIT})`;
      args[0] = `${args[0]}?tf_24464158=${encodeURIComponent(version)}`;
    }
    const win = window.open(...args);
    if (win) {
      win.opener = null;
    }
    return false;
  };

  if (process.env.BUILD_TYPE === 'phonegap') {
    window.handleOpenURL = function(url) {
      const { SafariViewController } = window;
      SafariViewController.hide();
      if (process.env.BUILD_PLATFORM === 'ios') window.StatusBar.setStyle(SafariViewController.statusBarStyle);
      setTimeout(() => {
        emitter.emit('handleOpenURL', url);
      }, 1);
    };
  }

  if (process.env.BUILD_TYPE === 'web') {
    window.handleOpenURL = function(url) {
      setTimeout(() => {
        emitter.emit('handleOpenURL', url);
      }, 1);
    };
  }

  if (process.env.BUILD_TYPE === 'electron') {
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('handleOpenURL', (event, url) => {
      emitter.emit('handleOpenURL', url);
    });
  }

  function setupBip21() {
    const params = querystring.parse(window.location.href.split('?')[1]);
    if (!bip21.getSchemeCryptoId(params.bip21)) return;
    window.localStorage.setItem('_cs_bip21', params.bip21);
  }

  function setupCrypto() {
    const { network, coin, crypto } = querystring.parse(window.location.href.split('?')[1]);
    if (crypto) return LS.setCryptoId(crypto);
    if (coin || network) { // legacy
      const cryptoId = `${coin || network}@${coin || network}`;
      return LS.setCryptoId(cryptoId);
    }
  }

  async function setLanguage() {
    const language = i18n.getLanguage(details.get('systemInfo').language);
    if (language !== i18n.getLanguage()) {
      await i18n.loadTranslation(language);
      localStorage.setItem('_cs_language', language);
    }
  }

};
