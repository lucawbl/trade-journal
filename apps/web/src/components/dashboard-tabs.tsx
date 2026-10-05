export function DashboardTabs({
  active: _active,
}: {
  active: "overview" | "bilan" | "accounts" | "calendar";
}) {
  // Les vues secondaires restent accessibles par URL pour compatibilité,
  // mais la navigation principale est volontairement limitée à
  // Dashboard / Marché / Historique / Bot.
  return null;
}
