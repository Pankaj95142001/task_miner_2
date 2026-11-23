import { useEffect, useRef, useState } from "react";

const EMBED_STYLE_ID = "deal-portal-embedded-tracker-style";
const EMBED_ROUTE_PREFIX = "#/";
const EMBEDDED_TRACKER_STYLES = `
  html, body {
    background: #f3f6fb !important;
  }

  #side,
  #top {
    display: none !important;
  }

  #mainwrap {
    margin-left: 0 !important;
    min-width: 0 !important;
  }

  main {
    padding: 14px 16px 28px !important;
  }
`;

export default function EmbeddedTrackerPage({ route = "dashboard", title = "Dashboard", onReadyAction = null }) {
  const iframeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const src = `/prototypes/fa-presales-deal-tracker.html${EMBED_ROUTE_PREFIX}${route}`;

  useEffect(() => {
    setIsReady(false);
  }, [route, onReadyAction]);

  function syncEmbeddedFrame() {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      return;
    }

    try {
      const nextHash = `${EMBED_ROUTE_PREFIX}${route}`;
      const frameWindow = frame.contentWindow;
      const frameDocument = frame.contentDocument || frameWindow.document;

      if (frameWindow.location.hash !== nextHash) {
        frameWindow.location.hash = nextHash;
      }

      if (frameDocument?.head && !frameDocument.getElementById(EMBED_STYLE_ID)) {
        const style = frameDocument.createElement("style");
        style.id = EMBED_STYLE_ID;
        style.textContent = EMBEDDED_TRACKER_STYLES;
        frameDocument.head.appendChild(style);
      }

      if (onReadyAction === "open-new-deal-intake") {
        window.setTimeout(() => {
          try {
            if (typeof frameWindow.modalNewDeal === "function") {
              frameWindow.modalNewDeal();
              return;
            }

            frameDocument?.querySelector('[data-act="newDeal"]')?.click();
          } catch {
            // Fail gracefully if the prototype action changes.
          }
        }, 0);
      }
    } catch {
      // Same-origin embed should allow styling; if not, fail gracefully and still show the frame.
    } finally {
      setIsReady(true);
    }
  }

  return (
    <section className="embedded-dashboard-page" aria-label={title}>
      <div className="compact-card embedded-dashboard-shell">
        <div className={`embedded-dashboard-frame-wrap ${isReady ? "is-ready" : ""}`.trim()}>
          {!isReady ? <div className="embedded-dashboard-loading">Loading {title}...</div> : null}
          <iframe ref={iframeRef} title={title} src={src} className="embedded-dashboard-frame" onLoad={syncEmbeddedFrame} />
        </div>
      </div>
    </section>
  );
}
