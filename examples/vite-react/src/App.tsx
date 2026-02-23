import { useState } from "react";
import { ToastProvider } from "@twist-toast/react";
import "./App.css";
import { modalToast, toast } from "./toast";

function App() {
  const [lastGlobalToastId, setLastGlobalToastId] = useState<string | null>(
    null,
  );
  const [lastModalToastId, setLastModalToastId] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <p className="eyebrow">twist-toast</p>
        <h1>Design-system-first toasts</h1>
        <p>
          The library controls behavior. You control every pixel. This example
          shows scoped providers, queueing, dedupe refresh, and programmatic
          dismissal.
        </p>
      </header>

      <section className="panel">
        <h2>Global scope (`scope=&quot;global&quot;`)</h2>
        <div className="controls">
          <button
            type="button"
            onClick={() => {
              const toastId = toast.success(
                {
                  title: "Profile saved",
                  description: "All updates are now live.",
                },
                { duration: 3200 },
              );
              setLastGlobalToastId(toastId);
            }}
          >
            Show success
          </button>
          <button
            type="button"
            onClick={() => {
              const toastId = toast.error(
                {
                  title: "Payment failed",
                  description: "Card authorization was declined.",
                  retryLabel: "Try again",
                },
                { role: "alert", duration: 7000 },
              );
              setLastGlobalToastId(toastId);
            }}
          >
            Show error alert
          </button>
          <button
            type="button"
            onClick={() => {
              const toastId = toast.custom(
                {
                  title: "Background sync",
                  description: "Click anywhere on the toast to dismiss.",
                  accent: "#1f7a8c",
                },
                { dismissOnClick: true },
              );
              setLastGlobalToastId(toastId);
            }}
          >
            Show custom
          </button>
          <button
            type="button"
            onClick={() => {
              toast.success({
                title: "Queue 1",
                description: "Visible slot #1",
              });
              toast.success({
                title: "Queue 2",
                description: "Visible slot #2",
              });
              toast.success({
                title: "Queue 3",
                description: "Queued until a slot opens",
              });
            }}
          >
            Queue burst (max=2)
          </button>
          <button
            type="button"
            onClick={() => {
              const nextCount = refreshCount + 1;
              setRefreshCount(nextCount);
              const toastId = toast.custom(
                {
                  title: "Sync in progress",
                  description: `Refresh attempt #${nextCount}`,
                  accent: "#8f3f71",
                },
                { id: "sync-status", duration: 6000 },
              );
              setLastGlobalToastId(toastId);
            }}
          >
            Refresh duplicate id
          </button>
          <button
            type="button"
            onClick={() => {
              if (lastGlobalToastId) {
                toast.dismiss(lastGlobalToastId);
              }
            }}
          >
            Dismiss last global
          </button>
          <button
            type="button"
            onClick={() => {
              toast.dismissAll();
            }}
          >
            Dismiss all global
          </button>
        </div>
      </section>

      <ToastProvider scope="modal">
        <section className="panel panel-muted">
          <h2>Modal scope (`scope=&quot;modal&quot;`)</h2>
          <p>
            Separate instance and queue. These toasts are isolated from the
            global scope and use a different default position.
          </p>
          <div className="controls">
            <button
              type="button"
              onClick={() => {
                const toastId = modalToast.info(
                  {
                    title: "Modal scoped info",
                    detail: "Rendered by the modal provider only.",
                  },
                  { duration: 4800 },
                );
                setLastModalToastId(toastId);
              }}
            >
              Show modal toast
            </button>
            <button
              type="button"
              onClick={() => {
                if (lastModalToastId) {
                  modalToast.dismiss(lastModalToastId);
                }
              }}
            >
              Dismiss modal toast
            </button>
            <button
              type="button"
              onClick={() => {
                modalToast.dismissAll();
              }}
            >
              Dismiss all modal
            </button>
          </div>
        </section>
      </ToastProvider>
    </main>
  );
}

export default App;
