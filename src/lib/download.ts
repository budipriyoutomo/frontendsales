/**
 * Unduhan berkas dari response (TODO 5.4).
 *
 * `/api/sales/export` mengembalikan stream CSV, bukan JSON. Kalau ditangani
 * seperti response biasa, isinya akan tampil sebagai teks mentah di layar.
 */

/**
 * Nama berkas diambil dari `Content-Disposition`, karena backend yang tahu
 * rentang tanggal dan outlet mana yang diekspor.
 */
export function namaFileDariHeader(
  header: string | null,
  cadangan: string,
): string {
  if (!header) return cadangan;

  // `filename*` (RFC 5987) menang kalau ada — bentuk itu yang membawa
  // karakter non-ASCII dengan benar.
  const rfc5987 = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(header);
  if (rfc5987) {
    try {
      return bersihkan(decodeURIComponent(rfc5987[1].trim()), cadangan);
    } catch {
      // Persen-encoding rusak — jatuh ke `filename` biasa di bawah.
    }
  }

  const biasa = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(header);
  if (biasa) {
    const nama = (biasa[1] ?? biasa[2] ?? "").trim();
    if (nama) return bersihkan(nama, cadangan);
  }

  return cadangan;
}

/**
 * Nama berkas datang dari server, jadi tidak boleh memuat path — browser
 * memang tidak akan menurutinya, tapi nama seperti `../../x` tetap tidak
 * layak dipakai apa adanya.
 */
function bersihkan(nama: string, cadangan: string): string {
  const dasar = nama.split(/[\\/]/).pop()?.trim();
  return dasar && dasar !== "." && dasar !== ".." ? dasar : cadangan;
}

export async function unduhResponse(
  response: Response,
  namaCadangan: string,
): Promise<void> {
  const blob = await response.blob();
  const nama = namaFileDariHeader(
    response.headers.get("content-disposition"),
    namaCadangan,
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nama;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Tanpa ini blob-nya menetap di memori sampai halaman ditutup.
  URL.revokeObjectURL(url);
}
