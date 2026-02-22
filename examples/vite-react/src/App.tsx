import { useState } from "react";
import { toast } from "./lib/toast";

function App() {
  const [lastToastId, setLastToastId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-100 to-white px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Example / Vite React
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            twist-toast playground
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Basic UI powered by Tailwind CSS. Use these controls to validate
            queueing, positions, timer behavior, pause on hover, and
            programmatic dismissal.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Trigger Toasts
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                const id = toast.success({ title: "Saved successfully" });
                setLastToastId(id);
              }}
            >
              Success
            </button>

            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                const id = toast.error(
                  {
                    title: "Failed to save",
                    description: "Try again in a few seconds.",
                  },
                  {
                    role: "alert",
                  },
                );
                setLastToastId(id);
              }}
            >
              Error (alert)
            </button>

            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                const id = toast.info(
                  { message: "This toast lasts 1 second" },
                  { duration: 1000 },
                );
                setLastToastId(id);
              }}
            >
              Info (1s)
            </button>

            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                const id = toast.info(
                  { message: "Bottom center toast" },
                  { position: "bottom-center" },
                );
                setLastToastId(id);
              }}
            >
              Bottom center
            </button>

            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                const id = toast.info(
                  { message: "No auto-dismiss. Click the toast to close." },
                  { duration: 0 },
                );
                setLastToastId(id);
              }}
            >
              Sticky
            </button>

            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                for (let i = 1; i <= 6; i += 1) {
                  toast.info({ message: `Queued toast #${i}` });
                }
              }}
            >
              Queue 6
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Programmatic controls
            </p>
            <p className="text-xs text-slate-500">
              Last toast id: {lastToastId ?? "none"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                if (lastToastId) {
                  toast.dismiss(lastToastId);
                  setLastToastId(null);
                }
              }}
              disabled={!lastToastId}
            >
              Dismiss last
            </button>
            <button
              type="button"
              className={"controlButtonClass"}
              onClick={() => {
                toast.dismissAll();
                setLastToastId(null);
              }}
            >
              Dismiss all
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
