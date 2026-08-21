import { useEffect, useState } from "react";

const STORAGE_KEY = "prono-ligue1-prono-reminders-enabled";

export function PronoReminderNotifications() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Les notifications ne sont pas disponibles sur ce navigateur.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Les notifications sont désactivées dans les réglages du navigateur.");
      return;
    }

    localStorage.setItem(STORAGE_KEY, "1");
    setEnabled(true);
  }

  function disableNotifications() {
    localStorage.removeItem(STORAGE_KEY);
    setEnabled(false);
  }

  return (
    <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">
            🔔 Rappels de pronostics
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            Reçois un rappel environ 1 heure avant un match si tu n'as pas
            encore fait ton pronostic.
          </div>
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={disableNotifications}
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300"
          >
            ACTIVÉ
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-[#06101c]"
          >
            ACTIVER
          </button>
        )}
      </div>
    </div>
  );
}
