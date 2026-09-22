/** Official Maps URLs need no key. Dates/times are reminders, not supported URL parameters. */
export function directionsLink(origin, destination, mode = "transit") {
  if (!origin?.trim() || !destination?.trim()) return "";
  if (!["transit", "walking"].includes(mode)) return "";
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    origin: origin.trim(),
    destination: destination.trim(),
    travelmode: mode,
  });
  return url.href.length <= 2048 ? url.href : "";
}

export function candidateLinks(properties, destination, mode) {
  return properties.map((property) => {
    // A name-only fallback needs the locality; never silently use the device location.
    const address = property.address?.trim();
    const origin =
      address ||
      (property.name?.trim() && property.district?.trim()
        ? `${property.district.trim()} ${property.name.trim()}`
        : "");
    return {
      id: property.id,
      name: property.name,
      origin,
      approximate: !address && !!origin,
      outbound: directionsLink(origin, destination, mode),
      returning: directionsLink(destination, origin, mode),
    };
  });
}
