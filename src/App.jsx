import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://prqrgcstfboexfehpmnt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycXJnY3N0ZmJvZXhmZWhwbW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjQyODIsImV4cCI6MjA5MjAwMDI4Mn0.cnK1AzYvH6jtvhLAnb8QWhz29j-6Y-d6wC6SgDOpQvg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const FACILITIES = {
  "kita-001": "Kita Musterhaus",
  "kita-002": "Kita Sonnenschein",
  "schule-001": "Schule Musterstadt",
};

function getISOWeek(date = new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function getFacilityFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("facility") || "";
}

function createEmptyRatings() {
  return DAYS.reduce((acc, day) => {
    acc[day] = "";
    return acc;
  }, {});
}

export default function TafelFeedbackApp() {
  const [facilityId] = useState(getFacilityFromUrl());
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState(createEmptyRatings());
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("upload");

  const facilityName = useMemo(() => {
    return FACILITIES[facilityId] || "Unbekannte Einrichtung";
  }, [facilityId]);

  const hasFacility = Boolean(facilityId && FACILITIES[facilityId]);

  const handlePhotoChange = (file) => {
    setPhoto(file || null);

    if (!file) {
      setPhotoPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const setDayRating = (day, value) => {
    setRatings((prev) => ({
      ...prev,
      [day]: value,
    }));
  };

  const analyzePhoto = async () => {
    if (!photo) {
      alert("Bitte zuerst ein Foto der Tafel auswählen.");
      return;
    }

    setAnalyzing(true);

    // Platzhalter für KI-Auswertung.
    // Später wird hier ein API-Aufruf an eine sichere Server-Funktion eingefügt.
    // Für die erste Version kann das Ergebnis manuell kontrolliert und korrigiert werden.
    await new Promise((resolve) => setTimeout(resolve, 800));

    setRatings({
      Montag: "up",
      Dienstag: "up",
      Mittwoch: "up",
      Donnerstag: "up",
      Freitag: "up",
    });

    setAnalyzing(false);
    setStep("review");
  };

  const uploadPhoto = async () => {
    if (!photo) return "";

    const safeName = photo.name.replace(/[^a-zA-Z0-9_.-]/g, "-");
    const filePath = `tafel/kw-${getISOWeek()}/${facilityId || "unknown"}-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("feedback-images")
      .upload(filePath, photo, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from("feedback-images").getPublicUrl(filePath);
    return data?.publicUrl || "";
  };

  const buildComment = () => {
    const resultText = DAYS.map((day) => `${day}: ${ratings[day] || "-"}`).join(" | ");

    return [
      "Quelle: Tafel-App",
      `Einrichtungs-ID: ${facilityId || "unbekannt"}`,
      `KI/Pruefung: ${resultText}`,
      comment.trim() ? `Kommentar: ${comment.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const saveFeedback = async () => {
    if (!hasFacility) {
      alert("Einrichtung konnte nicht erkannt werden. Bitte QR-Code pruefen.");
      return;
    }

    const missing = DAYS.filter((day) => !ratings[day]);
    if (missing.length > 0) {
      alert(`Bitte alle Tage pruefen: ${missing.join(", ")}`);
      return;
    }

    setSaving(true);

    try {
      const photoUrl = await uploadPhoto();

      const { error } = await supabase.from("feedback_entries").insert({
        kita_name: facilityName,
        ratings,
        comment: buildComment(),
        photo_url: photoUrl,
        kw: getISOWeek(),
      });

      if (error) throw new Error(error.message);

      alert("Tafel-Feedback gespeichert. Danke!");
      setPhoto(null);
      setPhotoPreview("");
      setComment("");
      setRatings(createEmptyRatings());
      setStep("upload");
    } catch (error) {
      alert(`Fehler beim Speichern: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Tafel-Auswertung</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Wochenfeedback per Foto</h1>
          <p className="mt-2 text-slate-500">
            Foto der Magnettafel aufnehmen, Ergebnis pruefen und speichern.
          </p>

          <div className={`mt-5 rounded-2xl p-4 ${hasFacility ? "bg-emerald-50" : "bg-red-50"}`}>
            <div className="text-sm text-slate-500">Erkannte Einrichtung</div>
            <div className={`mt-1 text-xl font-bold ${hasFacility ? "text-emerald-800" : "text-red-700"}`}>
              {facilityName}
            </div>
            {!hasFacility && (
              <p className="mt-2 text-sm text-red-700">
                Der QR-Code enthaelt keine gueltige Einrichtungs-ID. Beispiel: ?facility=kita-001
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
          <label className="block text-sm font-semibold text-slate-800">Foto der Tafel</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e.target.files?.[0])}
            className="mt-3 block w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm"
          />

          {photoPreview && (
            <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
              <img src={photoPreview} alt="Tafel Vorschau" className="max-h-96 w-full object-contain" />
            </div>
          )}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optionaler Kommentar zur Woche..."
            className="mt-4 h-28 w-full rounded-xl border border-emerald-200 p-3 outline-none focus:border-emerald-400"
          />

          <button
            type="button"
            onClick={analyzePhoto}
            disabled={!photo || analyzing || !hasFacility}
            className="mt-4 w-full rounded-2xl bg-emerald-600 px-6 py-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {analyzing ? "Tafel wird ausgewertet..." : "Tafel auswerten"}
          </button>
        </div>

        {step === "review" && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
            <h2 className="text-xl font-bold text-slate-900">Auswertung pruefen</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bitte kurz kontrollieren. Falls die KI daneben liegt, einfach korrigieren.
            </p>

            <div className="mt-4 space-y-3">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center justify-between rounded-2xl bg-emerald-50 p-4">
                  <div className="font-semibold text-slate-900">{day}</div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDayRating(day, "up")}
                      className={`rounded-xl px-4 py-2 text-2xl transition ${
                        ratings[day] === "up" ? "bg-emerald-500 scale-110" : "bg-white"
                      }`}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => setDayRating(day, "down")}
                      className={`rounded-xl px-4 py-2 text-2xl transition ${
                        ratings[day] === "down" ? "bg-red-400 scale-110" : "bg-white"
                      }`}
                    >
                      👎
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={saveFeedback}
              disabled={saving}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Wird gespeichert..." : "Auswertung speichern"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

