export default async function handler(req, res) {
  try {
    return res.status(200).json({
      Montag: "up",
      Dienstag: "down",
      Mittwoch: "up",
      Donnerstag: "up",
      Freitag: "down",
    });
  } catch (error) {
    return res.status(500).json({ error: "Fehler bei Analyse" });
  }
}
