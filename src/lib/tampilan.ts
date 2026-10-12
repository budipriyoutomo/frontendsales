/**
 * Warna aksen pilihan user (halaman Pengaturan).
 *
 * Disimpan di localStorage, jadi berlaku per browser — bukan per akun. Token
 * warnanya ada di `globals.css` (`:root[data-accent="…"]`); di sini hanya
 * daftar pilihan dan cara memasang/membacanya.
 */

export const AKSEN = [
  { id: "netral", label: "Netral", contoh: "#262626" },
  { id: "merah", label: "Merah bata", contoh: "#b6351b" },
  { id: "oranye", label: "Oranye", contoh: "#b74d00" },
  { id: "hijau", label: "Hijau", contoh: "#0b764d" },
  { id: "biru", label: "Biru", contoh: "#145ec1" },
  { id: "ungu", label: "Ungu", contoh: "#6f41c1" },
] as const;

export type Aksen = (typeof AKSEN)[number]["id"];

export const AKSEN_DEFAULT: Aksen = "netral";
export const KUNCI_AKSEN = "maharasa-aksen";
const EVENT_AKSEN = "maharasa-aksen-berubah";

export function aksenValid(nilai: unknown): nilai is Aksen {
  return AKSEN.some((a) => a.id === nilai);
}

/** Memasang aksen di <html>. Netral = atribut dihapus (token bawaan). */
export function pasangAksen(aksen: Aksen, root: HTMLElement): void {
  if (aksen === AKSEN_DEFAULT) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", aksen);
}

export function simpanAksen(aksen: Aksen): void {
  try {
    localStorage.setItem(KUNCI_AKSEN, aksen);
  } catch {
    // Mode privat / storage diblokir: tetap dipasang untuk sesi ini saja.
  }
  pasangAksen(aksen, document.documentElement);
  window.dispatchEvent(new Event(EVENT_AKSEN));
}

export function bacaAksenTerpasang(): Aksen {
  const nilai = document.documentElement.getAttribute("data-accent");
  return aksenValid(nilai) ? nilai : AKSEN_DEFAULT;
}

/** Untuk `useSyncExternalStore`: berubah saat aksen diganti di tab mana pun. */
export function langgananAksen(onUbah: () => void): () => void {
  const dariTabLain = (e: StorageEvent) => {
    if (e.key !== KUNCI_AKSEN) return;
    pasangAksen(
      aksenValid(e.newValue) ? e.newValue : AKSEN_DEFAULT,
      document.documentElement,
    );
    onUbah();
  };
  window.addEventListener(EVENT_AKSEN, onUbah);
  window.addEventListener("storage", dariTabLain);
  return () => {
    window.removeEventListener(EVENT_AKSEN, onUbah);
    window.removeEventListener("storage", dariTabLain);
  };
}

/**
 * Dijalankan di <head> sebelum halaman dirender, supaya warna aksen sudah
 * terpasang sejak frame pertama — tidak berkedip dari netral ke aksen.
 */
export const SKRIP_AKSEN = `(function(){try{var a=localStorage.getItem(${JSON.stringify(
  KUNCI_AKSEN,
)});if(${JSON.stringify(
  AKSEN.filter((a) => a.id !== AKSEN_DEFAULT).map((a) => a.id),
)}.indexOf(a)>=0)document.documentElement.setAttribute("data-accent",a)}catch(e){}})()`;
