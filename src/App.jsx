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

export default function App() {
  const [facilityId] = useState(getFacilityFromUrl());
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState(createEmptyRatings());
  const [step, setStep] = useState("upload");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
  if (!photo) return;

  setAnalyzing(true);

  const reader = new FileReader();
  reader.readAsDataURL(photo);

  reader.onload = async () => {
    const base64Image = reader.result;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      const data = await response.json();

      setRatings(data);
      setStep("review");
    } catch (error) {
      alert("Fehler bei der Auswertung");
    }

    setAnalyzing(false);
  };
};

    setAnalyzing(false);
    setStep("review");
  };

  const uploadPhoto = async () => {
    if (!photo) return "";

    const fileName = `${Date.now()}-${photo.name}`;

    const { error } = await supabase.storage
      .from("feedback-images")
      .upload(fileName, photo);

    if (error) {
      alert("Fehler beim Upload");
      return "";
    }

    const { data } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const saveFeedback = async () => {
    setSaving(true);

    const photoUrl = await uploadPhoto();

    await supabase.from("feedback_entries").insert({
      kita_name: facilityName,
      ratings,
      comment,
      photo_url: photoUrl,
      kw: getISOWeek(),
    });

    setSaving(false);

    // ✅ Erfolgsanzeige
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);

    // 🔄 Reset
    setPhoto(null);
    setPhotoPreview("");
    setComment("");
    setRatings(createEmptyRatings());
    setStep("upload");
  };

  return (
    <div className="min-h-screen bg-emerald-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {success && (
          <div className="rounded-2xl bg-emerald-100 p-4 text-center text-emerald-800 font-semibold">
            ✅ Feedback gespeichert – Danke!
          </div>
        )}

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Wochenfeedback per Foto</h1>

          <div className={`mt-4 p-3 rounded-xl ${hasFacility ? "bg-green-100" : "bg-red-100"}`}>
            {facilityName}
          </div>
        </div>

        {/* Upload */}
        {step === "upload" && (
          <div className="bg-white p-6 rounded-3xl shadow-sm">

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e.target.files[0])}
              className="w-full"
            />

            {photoPreview && (
              <img src={photoPreview} className="mt-4 rounded-xl" />
            )}

            <textarea
              placeholder="Optionaler Kommentar..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-4 w-full border p-3 rounded-xl"
            />

            <button
              onClick={analyzePhoto}
              className="mt-4 w-full bg-green-600 text-white p-3 rounded-xl"
            >
              📸 Tafel auswerten
            </button>
          </div>
        )}

        {/* Review */}
        {step === "review" && (
          <div className="bg-white p-6 rounded-3xl shadow-sm">
            <h2 className="font-bold mb-4">Auswertung prüfen</h2>

            {DAYS.map((day) => (
              <div key={day} className="flex justify-between mb-2">
                <span>{day}</span>
                <div>
                  <button onClick={() => setDayRating(day, "up")}>👍</button>
                  <button onClick={() => setDayRating(day, "down")}>👎</button>
                </div>
              </div>
            ))}

            <button
              onClick={saveFeedback}
              className="mt-4 w-full bg-black text-white p-3 rounded-xl"
            >
              💾 Speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
