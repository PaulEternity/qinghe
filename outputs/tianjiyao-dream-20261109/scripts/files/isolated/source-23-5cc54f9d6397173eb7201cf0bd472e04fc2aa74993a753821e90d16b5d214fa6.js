
              (function(){
                var notified = false;
                function notifyNativeReady(){
                  if (notified) return;
                  try {
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
                      notified = true;
                      window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
                    }
                  } catch(e) {}
                }
                notifyNativeReady();
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', notifyNativeReady);
                }
              })();
            